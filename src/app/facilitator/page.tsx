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

export default async function FacilitatorPage() {
  const session = await auth();
  const flags = await getFlags(session!.user.organizationId);

  const assignments = await prisma.courseFacilitator.findMany({
    where: { facilitatorId: session!.user.id },
    include: {
      course: {
        include: {
          lessons: true,
          enrollments: { include: { learner: true } },
        },
      },
    },
  });

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

      {assignments.length === 0 ? (
        <p className="text-sm text-grey-600">
          You&apos;re not assigned to any courses yet — ask an admin to assign you from
          the course&apos;s settings.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {assignments.map(({ course }) => {
            const totalLessons = course.lessons.length;
            return (
              <Card key={course.id} className="flex flex-col gap-4 p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
                  <div className="flex items-center gap-2">
                    <CardTitle>{course.title}</CardTitle>
                    <Badge pill>{course.enrollments.length} enrolled</Badge>
                  </div>
                  <EnrollLearnerPanel
                    courseId={course.id}
                    coursePath="/facilitator"
                    emailOptional={flags.learner_email_optional}
                  />
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
                          <th className="py-2.5 pr-6" />
                        </tr>
                      </thead>
                      <tbody>
                        {course.enrollments.map((enrollment) => (
                          <LearnerRow
                            key={enrollment.id}
                            learnerName={enrollment.learner.name}
                            learnerId={enrollment.learnerId}
                            courseId={course.id}
                            status={enrollment.status}
                            totalLessons={totalLessons}
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
  courseId,
  status,
  totalLessons,
}: {
  learnerName: string;
  learnerId: string;
  courseId: string;
  status: string;
  totalLessons: number;
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

  return (
    <tr className="border-b border-grey-200 last:border-0">
      <td className="px-6 py-3 text-ink">{learnerName}</td>
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
      <td className="py-3 pr-6 text-right">
        <ResetPasswordButton userId={learnerId} />
      </td>
    </tr>
  );
}
