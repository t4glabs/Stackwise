import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFlags } from "@/lib/flags";
import { Container } from "@/components/ui/container";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ProgressBar } from "@/components/progress-bar";
import { ResetPasswordButton } from "@/components/reset-password-button";
import { EnrollLearnerPanel } from "@/components/enroll-learner-panel";
import { CertificateCell } from "@/components/certificate-cell";
import { CohortManager, type CohortSummary } from "@/components/cohort-manager";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { Role } from "@/generated/prisma/client";

export default async function FacilitatorPage() {
  const session = await auth();
  const flags = await getFlags(session!.user.organizationId);

  // With facilitator_assignment off, there's no per-course scoping concept — every
  // facilitator manages every published course instead of only ones an admin
  // explicitly assigned them to (matches canManageCourseRoster in people-permissions.ts).
  const courseInclude = {
    lessons: true,
    enrollments: { include: { learner: true, cohort: { include: { facilitator: true } } } },
    certificates: true,
  } as const;

  const [courses, allFacilitators, allCohorts] = await Promise.all([
    flags.facilitator_assignment
      ? prisma.courseFacilitator
          .findMany({
            where: { facilitatorId: session!.user.id },
            include: { course: { include: courseInclude } },
          })
          .then((rows) => rows.map((a) => a.course))
      : prisma.course.findMany({
          where: { organizationId: session!.user.organizationId, published: true },
          include: courseInclude,
          orderBy: { title: "asc" },
        }),
    prisma.user.findMany({
      where: { organizationId: session!.user.organizationId, role: "FACILITATOR" },
      orderBy: { name: "asc" },
    }),
    // Org-wide, not scoped to any one course — see the note on the admin course page.
    prisma.cohort.findMany({
      where: { organizationId: session!.user.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const isAdmin = session!.user.role === "ADMIN";

  return (
    <Container className="flex flex-col gap-8 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Eyebrow className="mb-1.5">My space</Eyebrow>
          <h1 className="text-[26px] font-semibold tracking-tight text-ink">Your courses</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/facilitator/learners/new">Add a learner</Link>
        </Button>
      </div>

      {courses.length === 0 ? (
        <p className="text-sm text-grey-600">
          {flags.facilitator_assignment
            ? "You're not assigned to any courses yet — ask an admin to assign you from the course's settings."
            : "No published courses yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {courses.map((course) => {
            const totalLessons = course.lessons.length;
            const certificateByLearnerId = new Map(course.certificates.map((c) => [c.learnerId, c.id]));
            // Cohorts aren't owned by a course anymore — this is whichever cohorts
            // happen to have an enrollment in *this* course, derived from the
            // enrollments themselves (see the same pattern on the admin course page).
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
            const cohortSummaries = Array.from(cohortSummaryById.values()).sort((a, b) =>
              a.name.localeCompare(b.name)
            );
            return (
              <Card key={course.id} className="flex flex-col gap-4 p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
                  <div className="flex items-center gap-2">
                    <CardTitle>{course.title}</CardTitle>
                    <Badge pill>{course.enrollments.length} enrolled</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {flags.cohorts ? (
                      <CohortManager
                        coursePath="/facilitator"
                        cohorts={cohortSummaries}
                        allCohorts={allCohorts}
                        allFacilitators={allFacilitators.map((f) => ({ id: f.id, name: f.name }))}
                        isAdmin={isAdmin}
                      />
                    ) : null}
                    <EnrollLearnerPanel
                      courseId={course.id}
                      coursePath="/facilitator"
                      emailOptional={flags.learner_email_optional}
                      cohorts={flags.cohorts ? allCohorts : []}
                    />
                  </div>
                </div>

                {course.enrollments.length === 0 ? (
                  <p className="px-6 pb-6 text-sm text-grey-600">No learners enrolled yet.</p>
                ) : (
                  <div className="overflow-x-auto pb-6">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-y border-grey-200 bg-grey-50 text-left text-xs font-semibold uppercase tracking-wide text-grey-600">
                          <th className="px-6 py-2.5 font-semibold">Learner</th>
                          <th className="py-2.5 pr-4 font-semibold">Status</th>
                          <th className="py-2.5 pr-4 font-semibold">Progress</th>
                          {flags.cohorts ? (
                            <th className="py-2.5 pr-4 font-semibold">
                              <span className="flex items-center gap-1.5">
                                Cohort
                                <InfoTooltip label="What is a cohort?">
                                  <p>
                                    Which batch this learner was enrolled into (e.g. &quot;March
                                    2026 Batch&quot;) — a label for reporting only. It
                                    doesn&apos;t restrict what they can access or change what you
                                    can manage.
                                  </p>
                                </InfoTooltip>
                              </span>
                            </th>
                          ) : null}
                          {flags.certificates ? (
                            <th className="py-2.5 pr-4 font-semibold">Certificate</th>
                          ) : null}
                          <th className="py-2.5 pr-6" />
                        </tr>
                      </thead>
                      <tbody>
                        {course.enrollments.map((enrollment) => (
                          <LearnerRow
                            key={enrollment.id}
                            learnerName={enrollment.learner.name}
                            learnerId={enrollment.learnerId}
                            learnerRole={enrollment.learner.role}
                            courseId={course.id}
                            status={enrollment.status}
                            totalLessons={totalLessons}
                            certificatesFlagOn={flags.certificates}
                            certificateId={certificateByLearnerId.get(enrollment.learnerId) ?? null}
                            cohortsFlagOn={flags.cohorts}
                            cohortName={enrollment.cohort?.name ?? null}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Container>
  );
}

async function LearnerRow({
  learnerName,
  learnerId,
  learnerRole,
  courseId,
  status,
  totalLessons,
  certificatesFlagOn,
  certificateId,
  cohortsFlagOn,
  cohortName,
}: {
  learnerName: string;
  learnerId: string;
  learnerRole: Role;
  courseId: string;
  status: string;
  totalLessons: number;
  certificatesFlagOn: boolean;
  certificateId: string | null;
  cohortsFlagOn: boolean;
  cohortName: string | null;
}) {
  const done = totalLessons
    ? await prisma.progress.count({
        where: {
          learnerId,
          completedAt: { not: null },
          lesson: { courseId },
        },
      })
    : 0;
  const percent = totalLessons ? (done / totalLessons) * 100 : 0;

  // Nothing stops a staff account from also enrolling in a course as a learner (no
  // role restriction on enrollment) — when that happens, don't offer a reset here:
  // resetPasswordAction only lets a facilitator reset an actual LEARNER's password,
  // so the button would always fail. A small badge explains why the row looks
  // different instead of leaving it a silent mystery.
  const isActualLearner = learnerRole === "LEARNER";

  return (
    <tr className="border-b border-grey-200 last:border-0">
      <td className="px-6 py-3 text-ink">
        <span className="flex items-center gap-2">
          {learnerName}
          {!isActualLearner ? <Badge pill>{learnerRole === "ADMIN" ? "Admin" : "Facilitator"}</Badge> : null}
        </span>
      </td>
      <td className="py-3 pr-4">
        {status === "COMPLETED" ? (
          <Badge variant="success">Completed</Badge>
        ) : (
          <Badge variant="accent">Active</Badge>
        )}
      </td>
      <td className="w-48 py-3 pr-4">
        <ProgressBar percent={percent} />
      </td>
      {cohortsFlagOn ? <td className="py-3 pr-4 text-grey-600">{cohortName ?? "—"}</td> : null}
      {certificatesFlagOn ? (
        <td className="py-3 pr-4">
          <CertificateCell
            learnerId={learnerId}
            courseId={courseId}
            coursePath="/facilitator"
            completed={status === "COMPLETED"}
            certificateId={certificateId}
            canRevoke={false}
          />
        </td>
      ) : null}
      <td className="py-3 pr-6 text-right">
        {isActualLearner ? <ResetPasswordButton userId={learnerId} /> : null}
      </td>
    </tr>
  );
}
