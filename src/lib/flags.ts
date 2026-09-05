import { prisma } from "@/lib/prisma";

// The "turn it off if you don't need it" layer — see architecture plan, section 06.
// Every flag here is read by both route guards/server actions and the nav, so a
// disabled feature disappears from the UI *and* refuses the underlying request.
export const FEATURE_FLAGS = {
  self_enrollment: {
    label: "Self-enrollment",
    description: "Learners can enroll themselves without staff action.",
    default: true,
  },
  external_link_courses: {
    label: "External-link courses",
    description: "Courses that redirect out to platforms like Unithena.",
    default: true,
  },
  open_registration: {
    label: "Open registration",
    description: "Anyone can create a learner account vs. facilitator-invited only.",
    default: false,
  },
  facilitator_assignment: {
    label: "Facilitator assignment",
    description: "Facilitators can be explicitly assigned to courses.",
    default: true,
  },
  learner_email_optional: {
    label: "Learner email optional",
    description: "Allow adding a learner without an email address (they'll get a username instead).",
    default: false,
  },
  facilitator_email_optional: {
    label: "Facilitator email optional",
    description: "Allow adding a facilitator without an email address (they'll get a username instead).",
    default: false,
  },
  cohorts: {
    label: "Cohorts",
    description:
      "Group learners into standing batches (e.g. a partner site or intake) that auto-enroll " +
      "into whichever courses you attach — optionally scoped to specific facilitators too.",
    // Cohorts are the one concept here every LMS defines differently, so this gets a
    // fuller explanation wherever it shows up in the UI (see components/ui/info-tooltip
    // and cohort-manager.tsx) rather than just the one-line description above.
    example:
      "Example: you create a cohort named after a partner site (e.g. \"Riverside Center\"), " +
      "attach it to the 3 courses that site's learners take, then add each learner as a member — " +
      "they're instantly enrolled in all 3. Attach a 4th course to the cohort later, and everyone " +
      "already in it gets enrolled in that one too, automatically.\n\n" +
      "By itself, a cohort is just a group — it doesn't restrict anything. Optionally, a " +
      "facilitator can be scoped to one or more cohorts (set from that facilitator's own page " +
      "under People, not here) so they only see that cohort's members, across whichever courses " +
      "it follows — alongside, or instead of, being assigned to specific courses directly.\n\n" +
      "Turning this off just hides cohort UI everywhere; any cohorts and members you've already " +
      "created are kept, not deleted.",
    default: false,
  },
  // A sub-setting of `cohorts` — `parent` is what makes /admin/settings render this
  // nested under the Cohorts row instead of as its own top-level module, and only
  // when Cohorts itself is on (see admin/settings/page.tsx). This is deliberately
  // off by default: turning Cohorts on does *not* imply this. A deployment that just
  // wants cohorts for batch reporting shouldn't have its facilitators' course
  // assignment silently disabled — that's a real behavior change some orgs will want
  // and others never will, so it's its own explicit choice, not a side effect.
  cohort_restricted_facilitators_only: {
    label: "Cohort-only facilitators",
    parent: "cohorts" as const,
    description:
      "Facilitators are assigned to cohorts only, not directly to courses — for " +
      "deployments where every facilitator should be scoped to one group, not " +
      "everyone enrolled in any course they're given.",
    example:
      "With this on, a facilitator's access comes entirely from which cohort(s) they're " +
      "linked to (set on the facilitator's own page) — they see only that cohort's members, " +
      "across whichever courses that cohort follows. The course-level \"Facilitators\" list on " +
      "each course's settings is hidden, since it stops being how access gets granted.\n\n" +
      "Leave this off if you want both options available — some facilitators assigned broadly " +
      "to specific courses (seeing everyone enrolled in them), others scoped to just one " +
      "cohort. Most orgs that don't have separate partner groups to keep apart will never " +
      "need this on at all.",
    default: false,
  },
  certificates: {
    label: "Certificates",
    description: "Auto-generated completion certificates.",
    default: false,
  },
  public_catalog: {
    label: "Public catalog",
    description: "Course list is visible without logging in.",
    default: true,
  },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export async function getFlags(organizationId: string): Promise<Record<FeatureFlagKey, boolean>> {
  const rows = await prisma.featureFlag.findMany({ where: { organizationId } });
  const overrides = new Map(rows.map((r) => [r.key, r.enabled]));

  return Object.fromEntries(
    (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map((key) => [
      key,
      overrides.get(key) ?? FEATURE_FLAGS[key].default,
    ])
  ) as Record<FeatureFlagKey, boolean>;
}

export async function isFeatureEnabled(organizationId: string, key: FeatureFlagKey) {
  const row = await prisma.featureFlag.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  return row?.enabled ?? FEATURE_FLAGS[key].default;
}

export async function setFlag(organizationId: string, key: FeatureFlagKey, enabled: boolean) {
  await prisma.featureFlag.upsert({
    where: { organizationId_key: { organizationId, key } },
    create: { organizationId, key, enabled },
    update: { enabled },
  });
}
