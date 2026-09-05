import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFlags } from "@/lib/flags";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/progress-bar";
import { ResetPasswordButton } from "@/components/reset-password-button";
import { DeactivateUserButton } from "@/components/deactivate-user-button";
import { DeleteUserButton } from "@/components/delete-user-button";
import { CertificateCell } from "@/components/certificate-cell";
import { ArrowLeft } from "lucide-react";

export default async function AdminLearnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const organizationId = session!.user.organizationId;

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
    // One query for this learner's whole history rather than one per enrollment —
    // same pattern as every other progress rollup in the app.
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

  const coursePath = `/admin/people/learners/${learner.id}`;

  return (
    <div className="flex min-w-0 max-w-3xl flex-col gap-6">
      <Link
        href="/admin/people?tab=learners"
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-grey-600 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> All learners
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow className="mb-1.5">Learner</Eyebrow>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-ink">{learner.name}</h2>
            {learner.disabledAt ? <Badge variant="neutral">Deactivated</Badge> : null}
          </div>
          <p className="mt-1 font-mono text-sm text-grey-600">{learner.email ?? learner.username}</p>
        </div>
        <div className="flex items-center gap-1">
          <ResetPasswordButton userId={learner.id} />
          <DeactivateUserButton userId={learner.id} disabled={Boolean(learner.disabledAt)} />
        </div>
      </div>

      {learner.disabledAt ? (
        <Card className="flex flex-row flex-wrap items-center justify-between gap-3 border-danger/30 bg-danger-soft">
          <p className="text-sm text-danger">
            This account is deactivated — {learner.name} can&apos;t log in, but every enrollment,
            progress record, and certificate below is untouched.
          </p>
          <DeleteUserButton userId={learner.id} name={learner.name ?? ""} redirectTo="/admin/people?tab=learners" />
        </Card>
      ) : null}

      <Card className="flex flex-col gap-2">
        <CardTitle>Cohorts</CardTitle>
        {learner.cohortMemberships.length === 0 ? (
          <p className="text-sm text-grey-600">Not part of any cohort.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {learner.cohortMemberships.map((cm) => (
              <li key={cm.cohort.id}>
                <Link
                  href={`/admin/cohorts/${cm.cohort.id}`}
                  className="rounded-full bg-grey-100 px-3 py-1 text-grey-700 hover:text-ink"
                >
                  {cm.cohort.name}
                </Link>
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
                      <td className="px-5 py-3 text-ink">
                        <Link href={`/admin/courses/${enrollment.course.id}`} className="text-accent hover:underline">
                          {enrollment.course.title}
                        </Link>
                      </td>
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
                            canRevoke
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
    </div>
  );
}
