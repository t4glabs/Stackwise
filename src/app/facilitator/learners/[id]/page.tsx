import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFlags } from "@/lib/flags";
import { canManageLearner } from "@/lib/people-permissions";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/progress-bar";
import { ResetPasswordButton } from "@/components/reset-password-button";
import { CertificateCell } from "@/components/certificate-cell";
import { ArrowLeft } from "lucide-react";

// Not under /admin — reachable by any facilitator who can actually manage this
// learner, whether that's through a direct course assignment or a cohort link.
// canManageLearner is the real gate; a facilitator hitting this for someone outside
// both of those gets a 404, same pattern as the cohort detail page.
export default async function FacilitatorLearnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const organizationId = session!.user.organizationId;

  const allowed = await canManageLearner(session!.user.id, session!.user.role, id);
  if (!allowed) notFound();

  const learner = await prisma.user.findFirst({
    where: { id, organizationId, role: "LEARNER" },
    include: {
      cohortMemberships: { include: { cohort: { select: { id: true, name: true } } }, orderBy: { cohort: { name: "asc" } } },
      enrollments: {
        include: { course: { select: { id: true, title: true } } },
        orderBy: { course: { title: "asc" } },
      },
      certificates: { select: { id: true, courseId: true } },
    },
  });
  if (!learner) notFound();

  const courseIds = learner.enrollments.map((e) => e.courseId);

  const [flags, totalsByCourse, completedProgress] = await Promise.all([
    getFlags(organizationId),
    prisma.lesson.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds }, hidden: false }, _count: { _all: true } }),
    prisma.progress.findMany({
      where: { learnerId: id, completedAt: { not: null }, lesson: { courseId: { in: courseIds }, hidden: false } },
      select: { lesson: { select: { courseId: true } } },
    }),
  ]);

  const totalByCourseId = new Map(totalsByCourse.map((t) => [t.courseId, t._count._all]));
  const doneByCourseId = new Map<string, number>();
  for (const p of completedProgress) {
    const cid = p.lesson.courseId;
    doneByCourseId.set(cid, (doneByCourseId.get(cid) ?? 0) + 1);
  }
  const certificateIdByCourseId = new Map(learner.certificates.map((c) => [c.courseId, c.id]));

  const coursePath = `/facilitator/learners/${learner.id}`;

  return (
    <Container className="flex flex-col gap-6 py-12">
      <Link
        href="/facilitator"
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-grey-600 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Your courses
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow className="mb-1.5">Learner</Eyebrow>
          <h1 className="text-[26px] font-semibold tracking-tight text-ink">{learner.name}</h1>
          <p className="mt-1 font-mono text-sm text-grey-600">{learner.email ?? learner.username}</p>
        </div>
        <ResetPasswordButton userId={learner.id} />
      </div>

      <Card className="flex flex-col gap-2">
        <CardTitle>Cohorts</CardTitle>
        {learner.cohortMemberships.length === 0 ? (
          <p className="text-sm text-grey-600">Not part of any cohort.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {learner.cohortMemberships.map((cm) => (
              <li key={cm.cohort.id} className="rounded-full bg-grey-100 px-3 py-1 text-grey-700">
                {cm.cohort.name}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-0">
        <CardTitle className="px-5 pt-5">Courses ({learner.enrollments.length})</CardTitle>
        {learner.enrollments.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-grey-600">Not enrolled in anything yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-grey-200 bg-grey-50 text-left text-xs font-semibold uppercase tracking-wide text-grey-600">
                  <th className="px-5 py-2.5">Course</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Progress</th>
                  {flags.certificates ? <th className="px-4 py-2.5">Certificate</th> : null}
                </tr>
              </thead>
              <tbody>
                {learner.enrollments.map((enrollment) => {
                  const total = totalByCourseId.get(enrollment.courseId) ?? 0;
                  const done = doneByCourseId.get(enrollment.courseId) ?? 0;
                  const percent = total ? (done / total) * 100 : 0;
                  return (
                    <tr key={enrollment.id} className="border-b border-grey-200 last:border-0">
                      <td className="px-5 py-3 text-ink">{enrollment.course.title}</td>
                      <td className="px-4 py-3">
                        {enrollment.status === "COMPLETED" ? (
                          <Badge variant="success">Completed</Badge>
                        ) : enrollment.status === "WITHDRAWN" ? (
                          <Badge variant="neutral">Withdrawn</Badge>
                        ) : (
                          <Badge variant="accent">Active</Badge>
                        )}
                      </td>
                      <td className="w-40 px-4 py-3">
                        <ProgressBar percent={percent} />
                      </td>
                      {flags.certificates ? (
                        <td className="px-4 py-3">
                          <CertificateCell
                            learnerId={learner.id}
                            courseId={enrollment.course.id}
                            coursePath={coursePath}
                            completed={enrollment.status === "COMPLETED"}
                            certificateId={certificateIdByCourseId.get(enrollment.course.id) ?? null}
                            canRevoke={false}
                          />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Container>
  );
}
