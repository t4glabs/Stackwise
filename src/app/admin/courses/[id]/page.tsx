import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFlags } from "@/lib/flags";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Badge } from "@/components/ui/badge";
import { CourseConfigForm } from "@/components/course-config-form";
import { EnrollLearnerPanel } from "@/components/enroll-learner-panel";
import { CertificateCell } from "@/components/certificate-cell";
import { CohortManager, type CohortSummary } from "@/components/cohort-manager";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { ArrowLeft } from "lucide-react";

export default async function AdminCourseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const course = await prisma.course.findFirst({
    where: { id, organizationId: session!.user.organizationId },
    include: {
      program: true,
      facilitators: true,
      enrollments: {
        include: { learner: true, cohort: { include: { facilitator: true } } },
        orderBy: { enrolledAt: "desc" },
      },
      certificates: true,
    },
  });
  if (!course) notFound();

  const certificateByLearnerId = new Map(course.certificates.map((c) => [c.learnerId, c.id]));

  // Cohorts aren't owned by a course anymore (see schema.prisma) — this panel manages
  // whichever cohorts happen to have an enrollment in *this* course, derived straight
  // from the enrollments rather than a course.cohorts relation that no longer exists.
  const cohortSummaryById = new Map<string, CohortSummary>();
  for (const enrollment of course.enrollments) {
    if (!enrollment.cohort) continue;
    const existing = cohortSummaryById.get(enrollment.cohort.id);
    if (existing) {
      existing.enrolledCount += 1;
      if (enrollment.status === "COMPLETED") existing.completedCount += 1;
    } else {
      cohortSummaryById.set(enrollment.cohort.id, {
        id: enrollment.cohort.id,
        name: enrollment.cohort.name,
        facilitatorName: enrollment.cohort.facilitator?.name ?? null,
        startDate: enrollment.cohort.startDate?.toISOString() ?? null,
        endDate: enrollment.cohort.endDate?.toISOString() ?? null,
        enrolledCount: 1,
        completedCount: enrollment.status === "COMPLETED" ? 1 : 0,
      });
    }
  }
  const cohortSummaries = Array.from(cohortSummaryById.values()).sort((a, b) => a.name.localeCompare(b.name));

  const [programs, facilitators, allCohorts, flags] = await Promise.all([
    prisma.program.findMany({
      where: { organizationId: session!.user.organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: session!.user.organizationId, role: "FACILITATOR" },
      orderBy: { name: "asc" },
    }),
    // Org-wide, not scoped to this course — the "reuse an existing cohort" list, and
    // what the enroll panel's cohort dropdown offers regardless of which course.
    prisma.cohort.findMany({
      where: { organizationId: session!.user.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getFlags(session!.user.organizationId),
  ]);

  const coursePath = `/admin/courses/${course.id}`;

  return (
    <div className="flex min-w-0 max-w-4xl flex-col gap-6">
      <Link
        href="/admin/courses"
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-grey-600 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> All courses
      </Link>

      <div>
        <Eyebrow className="mb-1.5">From your wiki</Eyebrow>
        <h2 className="text-xl font-semibold tracking-tight text-ink">{course.title}</h2>
        {course.description ? (
          <p className="mt-1 text-sm text-grey-600">{course.description}</p>
        ) : null}
      </div>

      <CourseConfigForm
        courseId={course.id}
        published={course.published}
        type={course.type}
        programName={course.program?.name ?? ""}
        durationLabel={course.durationLabel ?? ""}
        externalUrl={course.externalUrl ?? ""}
        downloadableWorkbook={course.downloadableWorkbook}
        certificateEnabled={course.certificateEnabled}
        certificatesFlagOn={flags.certificates}
        externalLinkCoursesFlagOn={flags.external_link_courses}
        facilitatorAssignmentFlagOn={flags.facilitator_assignment}
        assignedFacilitatorIds={course.facilitators.map((f) => f.facilitatorId)}
        allPrograms={programs.map((p) => p.name)}
        allFacilitators={facilitators.map((f) => ({ id: f.id, name: f.name }))}
      />

      <div className="flex flex-col gap-3 border-t border-grey-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>Enrolled learners ({course.enrollments.length})</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {flags.cohorts ? (
              <CohortManager
                coursePath={coursePath}
                cohorts={cohortSummaries}
                allCohorts={allCohorts}
                allFacilitators={facilitators.map((f) => ({ id: f.id, name: f.name }))}
                isAdmin={session!.user.role === "ADMIN"}
              />
            ) : null}
            <EnrollLearnerPanel
              courseId={course.id}
              coursePath={coursePath}
              emailOptional={flags.learner_email_optional}
              cohorts={flags.cohorts ? allCohorts : []}
            />
          </div>
        </div>

        {course.enrollments.length === 0 ? (
          <p className="text-sm text-grey-600">No one enrolled yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-grey-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-200 bg-grey-50 text-left text-xs font-semibold uppercase tracking-wide text-grey-600">
                  <th className="px-5 py-2.5">Learner</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Source</th>
                  {flags.cohorts ? (
                    <th className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5">
                        Cohort
                        <InfoTooltip label="What is a cohort?">
                          <p>
                            Which batch this learner was enrolled into (e.g. &quot;March 2026
                            Batch&quot;) — a label for reporting only. It doesn&apos;t restrict
                            what they can access.
                          </p>
                        </InfoTooltip>
                      </span>
                    </th>
                  ) : null}
                  {flags.certificates ? <th className="px-4 py-2.5">Certificate</th> : null}
                </tr>
              </thead>
              <tbody>
                {course.enrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="border-b border-grey-200 last:border-0">
                    <td className="px-5 py-3 text-ink">
                      <span className="flex items-center gap-2">
                        {enrollment.learner.name}
                        {enrollment.learner.role !== "LEARNER" ? (
                          <Badge pill>{enrollment.learner.role === "ADMIN" ? "Admin" : "Facilitator"}</Badge>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {enrollment.status === "COMPLETED" ? (
                        <Badge variant="success">Completed</Badge>
                      ) : (
                        <Badge variant="accent">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-grey-600">
                      {enrollment.source === "SELF" ? "Self-enrolled" : "Assigned"}
                    </td>
                    {flags.cohorts ? (
                      <td className="px-4 py-3 text-grey-600">{enrollment.cohort?.name ?? "—"}</td>
                    ) : null}
                    {flags.certificates ? (
                      <td className="px-4 py-3">
                        <CertificateCell
                          learnerId={enrollment.learnerId}
                          courseId={course.id}
                          coursePath={coursePath}
                          completed={enrollment.status === "COMPLETED"}
                          certificateId={certificateByLearnerId.get(enrollment.learnerId) ?? null}
                          canRevoke
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
