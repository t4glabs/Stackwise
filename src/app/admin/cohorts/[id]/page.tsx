import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/flags";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Card } from "@/components/ui/card";
import { CohortDetailPanel, type CohortMemberRow, type CohortCourseRow } from "@/components/cohort-detail-panel";
import { DeleteCohortButton } from "@/components/delete-cohort-button";
import { ArrowLeft } from "lucide-react";

function formatRange(start: Date | null, end: Date | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return start ? `From ${fmt(start)}` : `Until ${fmt(end!)}`;
}

export default async function AdminCohortDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const organizationId = session!.user.organizationId;

  const enabled = await isFeatureEnabled(organizationId, "cohorts");
  if (!enabled) notFound();

  const cohort = await prisma.cohort.findFirst({
    where: { id, organizationId },
    include: {
      members: { include: { learner: true }, orderBy: { learner: { name: "asc" } } },
      courses: { include: { course: true }, orderBy: { course: { title: "asc" } } },
      facilitators: { include: { facilitator: true }, orderBy: { facilitator: { name: "asc" } } },
      enrollments: { select: { courseId: true, status: true } },
    },
  });
  if (!cohort) notFound();

  const courseIds = cohort.courses.map((cc) => cc.course.id);
  const memberLearnerIds = cohort.members.map((m) => m.learnerId);

  const [allCourses, emailOptional, certificatesFlagOn, totalLessons, completionByLearnerId, certifiedLearnerIds] =
    await Promise.all([
      prisma.course.findMany({ where: { organizationId }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
      isFeatureEnabled(organizationId, "learner_email_optional"),
      isFeatureEnabled(organizationId, "certificates"),
      prisma.lesson.count({ where: { courseId: { in: courseIds }, hidden: false } }),
      // Grouped in one query rather than once per member — a cohort's roster can run
      // into the dozens, and this is rendered on every page load.
      prisma.progress.groupBy({
        by: ["learnerId"],
        where: {
          completedAt: { not: null },
          lesson: { courseId: { in: courseIds }, hidden: false },
        },
        _count: { _all: true },
      }),
      prisma.certificate.groupBy({
        by: ["learnerId"],
        where: { learnerId: { in: memberLearnerIds }, courseId: { in: courseIds } },
      }),
    ]);
  const completedByLearnerId = new Map(completionByLearnerId.map((c) => [c.learnerId, c._count._all]));
  const certifiedLearnerIdSet = new Set(certifiedLearnerIds.map((c) => c.learnerId));

  const statsByCourseId = new Map<string, { enrolledCount: number; completedCount: number }>();
  for (const e of cohort.enrollments) {
    const s = statsByCourseId.get(e.courseId) ?? { enrolledCount: 0, completedCount: 0 };
    s.enrolledCount += 1;
    if (e.status === "COMPLETED") s.completedCount += 1;
    statsByCourseId.set(e.courseId, s);
  }

  const members: CohortMemberRow[] = cohort.members.map((m) => ({
    id: m.learner.id,
    name: m.learner.name,
    identifier: m.learner.email ?? m.learner.username,
    // Against every lesson across every course this cohort follows — not just the
    // courses this one member happens to be enrolled in (see the type's own comment).
    percent: totalLessons ? ((completedByLearnerId.get(m.learner.id) ?? 0) / totalLessons) * 100 : 0,
    hasCertificate: certifiedLearnerIdSet.has(m.learner.id),
    href: `/admin/people/learners/${m.learner.id}`,
  }));

  const courses: CohortCourseRow[] = cohort.courses.map((cc) => ({
    id: cc.course.id,
    title: cc.course.title,
    enrolledCount: statsByCourseId.get(cc.course.id)?.enrolledCount ?? 0,
    completedCount: statsByCourseId.get(cc.course.id)?.completedCount ?? 0,
    linkable: true,
  }));

  const attachedCourseIds = new Set(cohort.courses.map((cc) => cc.course.id));
  const availableCourses = allCourses.filter((c) => !attachedCourseIds.has(c.id));

  return (
    <div className="flex min-w-0 max-w-4xl flex-col gap-6">
      <Link
        href="/admin/cohorts"
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-grey-600 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> All cohorts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow className="mb-1.5">Cohort</Eyebrow>
          <h2 className="text-xl font-semibold tracking-tight text-ink">{cohort.name}</h2>
          {formatRange(cohort.startDate, cohort.endDate) ? (
            <p className="mt-1 text-sm text-grey-600">{formatRange(cohort.startDate, cohort.endDate)}</p>
          ) : null}
        </div>
        <DeleteCohortButton cohortId={cohort.id} name={cohort.name} />
      </div>

      <Card className="flex flex-col gap-2">
        <Eyebrow>Facilitators</Eyebrow>
        {cohort.facilitators.length === 0 ? (
          <p className="text-sm text-grey-600">
            Nobody&apos;s scoped to this cohort yet — link a facilitator from their own page under{" "}
            <Link href="/admin/people?tab=facilitators" className="text-accent hover:underline">
              People → Facilitators
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {cohort.facilitators.map((f) => (
              <li key={f.facilitatorId}>
                <Link
                  href={`/admin/people/facilitators/${f.facilitatorId}`}
                  className="rounded-full bg-grey-100 px-3 py-1 text-grey-700 hover:text-ink"
                >
                  {f.facilitator.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CohortDetailPanel
        cohortId={cohort.id}
        members={members}
        courses={courses}
        availableCourses={availableCourses}
        emailOptional={emailOptional}
        certificatesFlagOn={certificatesFlagOn}
      />
    </div>
  );
}
