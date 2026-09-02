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
    description: "Batch/cohort grouping for facilitated programs.",
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
