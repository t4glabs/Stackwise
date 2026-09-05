import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/flags";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Card, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { FacilitatorCohortChecklist } from "@/components/facilitator-cohort-checklist";
import { ArrowLeft } from "lucide-react";

export default async function AdminFacilitatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const organizationId = session!.user.organizationId;

  const [cohortsEnabled, facilitatorAssignmentFlagOn] = await Promise.all([
    isFeatureEnabled(organizationId, "cohorts"),
    isFeatureEnabled(organizationId, "facilitator_assignment"),
  ]);
  if (!cohortsEnabled) notFound();

  const facilitator = await prisma.user.findFirst({
    where: { id, organizationId, role: "FACILITATOR" },
    include: {
      facilitatingCourses: { include: { course: { select: { id: true, title: true } } } },
      facilitatingCohorts: { select: { cohortId: true } },
    },
  });
  if (!facilitator) notFound();

  const cohorts = await prisma.cohort.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const linkedCohortIds = facilitator.facilitatingCohorts.map((c) => c.cohortId);
  const courseCount = facilitator.facilitatingCourses.length;
  const cohortCount = linkedCohortIds.length;

  // One plain sentence stating the actual, current net effect of the two sections
  // below — so an admin doesn't have to mentally combine "assigned to N courses,"
  // "linked to M cohorts," AND the org's own facilitator_assignment setting
  // themselves to know what this person can actually do. Course assignment being
  // off org-wide is the one thing that changes the story completely: it means the
  // list below isn't what's actually granting access — every facilitator already
  // sees every published course regardless of it.
  let accessSummary: string;
  if (!facilitatorAssignmentFlagOn) {
    accessSummary =
      "Course-level assignment is switched off for this whole organization (Settings → Facilitator assignment), so this doesn't depend on the list below at all — every facilitator, including this one, already sees every published course." +
      (cohortCount > 0
        ? ` They're also linked to ${cohortCount} cohort${cohortCount === 1 ? "" : "s"} above — that still narrows who they can manage individually (like resetting a password) to that cohort's members.`
        : "");
  } else if (courseCount === 0 && cohortCount === 0) {
    accessSummary =
      "Right now, this person can't see or manage anyone — not assigned to a course below, and not linked to a cohort above. Do one of the two to give them somewhere to work.";
  } else if (courseCount > 0 && cohortCount === 0) {
    accessSummary = `Sees every learner enrolled in the ${courseCount} course${courseCount === 1 ? "" : "s"} below — nothing outside ${courseCount === 1 ? "it" : "them"}.`;
  } else if (courseCount === 0 && cohortCount > 0) {
    accessSummary = `Sees only the members of the ${cohortCount} cohort${cohortCount === 1 ? "" : "s"} above, across whichever courses ${cohortCount === 1 ? "it" : "they"} follow${cohortCount === 1 ? "s" : ""} — no other course, even a published one they're not otherwise tied to.`;
  } else {
    accessSummary = `Sees everyone in the ${courseCount} course${courseCount === 1 ? "" : "s"} below, plus everyone in the ${cohortCount} cohort${cohortCount === 1 ? "" : "s"} above — the two add together, neither one narrows the other.`;
  }

  return (
    <div className="flex min-w-0 max-w-2xl flex-col gap-6">
      <Link
        href="/admin/people?tab=facilitators"
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-grey-600 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> All facilitators
      </Link>

      <div>
        <Eyebrow className="mb-1.5">Facilitator</Eyebrow>
        <h2 className="text-xl font-semibold tracking-tight text-ink">{facilitator.name}</h2>
        <p className="mt-1 font-mono text-sm text-grey-600">{facilitator.email ?? facilitator.username}</p>
      </div>

      <div
        className={`rounded-card border px-4 py-3 text-sm ${
          facilitatorAssignmentFlagOn && courseCount === 0 && cohortCount === 0
            ? "border-warning/30 bg-warning-soft text-warning"
            : "border-accent/20 bg-accent-soft text-ink"
        }`}
      >
        <span className="font-medium">What they can actually do right now: </span>
        {accessSummary}
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5">
          <CardTitle>Cohorts managed</CardTitle>
          <InfoTooltip label="What does this do?">
            <p>
              Turning one on here scopes this facilitator to only that cohort&apos;s
              members — across whichever courses the cohort follows — regardless of what&apos;s
              set in &quot;Courses assigned directly&quot; below. It&apos;s the same idea as a
              teacher who&apos;s only responsible for one class, not the whole school.
            </p>
            <p className="mt-2">
              This is purely additive: it never takes away a course assignment this facilitator
              already has. It just adds cohort members as a second, independent way for them to
              reach people — see the summary above for what the combination actually adds up to.
            </p>
          </InfoTooltip>
        </div>
        <p className="text-sm text-grey-700">
          Each switch below links this facilitator to that cohort — set only here, on this
          person&apos;s own page, not from the cohort&apos;s page.
        </p>
        {cohorts.length === 0 ? (
          <p className="text-sm text-grey-600">
            No cohorts exist in this organization yet — nothing to link to. Create one under Admin
            → Cohorts first.
          </p>
        ) : (
          <FacilitatorCohortChecklist
            facilitatorId={facilitator.id}
            cohorts={cohorts}
            linkedCohortIds={linkedCohortIds}
          />
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Courses assigned directly</CardTitle>
        <p className="text-sm text-grey-700">
          Read-only here — this list only changes when an admin adds or removes this person from
          a course&apos;s own &quot;Facilitators&quot; checklist, on that course&apos;s settings
          page. Being added there gives unrestricted access to everyone enrolled in that one
          course; it&apos;s never set from this page.
        </p>
        {!facilitatorAssignmentFlagOn ? (
          <p className="text-xs text-grey-500">
            Course-level assignment is off for this whole organization right now, so this list
            isn&apos;t actually gating anything — see the summary above. It&apos;s kept below in
            case &quot;Facilitator assignment&quot; gets turned back on under Settings later.
          </p>
        ) : null}
        {courseCount === 0 ? (
          <p className="text-sm text-grey-600">
            Not on any course&apos;s Facilitators list yet. To add one: open that course under
            Admin → Courses, and check this person&apos;s name in its Facilitators section — it
            will then show up here automatically.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {facilitator.facilitatingCourses.map((fc) => (
              <li key={fc.course.id}>
                <Link href={`/admin/courses/${fc.course.id}`} className="text-accent hover:underline">
                  {fc.course.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
