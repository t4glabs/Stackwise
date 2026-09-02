import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/progress-bar";

export default async function FacilitatorPage() {
  const session = await auth();

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
    <Container className="flex flex-col gap-8 py-14">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Your courses</h1>
        <Button variant="outline" asChild>
          <Link href="/facilitator/learners/new">Add a learner</Link>
        </Button>
      </div>

      {assignments.length === 0 ? (
        <p className="text-sm text-grey-600">
          You&apos;re not assigned to any courses yet — an admin can assign you from BookStack&apos;s
          <code className="mx-1 rounded bg-grey-100 px-1.5 py-0.5">lms_facilitator</code> tag, or in the database directly for now.
        </p>
      ) : (
        assignments.map(({ course }) => {
          const totalLessons = course.lessons.length;
          return (
            <Card key={course.id} className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle>{course.title}</CardTitle>
                <Badge variant="neutral">{course.enrollments.length} enrolled</Badge>
              </div>

              {course.enrollments.length === 0 ? (
                <p className="text-sm text-grey-600">No learners enrolled yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-grey-200 text-left text-xs font-bold uppercase tracking-wide text-grey-600">
                        <th className="py-2 pr-4">Learner</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2">Progress</th>
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
        })
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
    <tr className="border-b border-grey-100 last:border-0">
      <td className="py-2.5 pr-4 text-ink">{learnerName}</td>
      <td className="py-2.5 pr-4">
        {status === "COMPLETED" ? (
          <Badge variant="success">Completed</Badge>
        ) : (
          <Badge variant="accent">Active</Badge>
        )}
      </td>
      <td className="w-48 py-2.5">
        <ProgressBar percent={percent} />
      </td>
    </tr>
  );
}
