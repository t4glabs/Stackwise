import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/progress-bar";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const enrollments = await prisma.enrollment.findMany({
    where: { learnerId: userId },
    include: {
      course: { include: { lessons: true, program: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const progress = await prisma.progress.findMany({
    where: { learnerId: userId, completedAt: { not: null } },
  });
  const completedLessonIds = new Set(progress.map((p) => p.lessonId));

  return (
    <Container className="flex flex-col gap-8 py-14">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Welcome back, {session!.user.name}
        </h1>
        <Button variant="outline" asChild>
          <Link href="/courses">Browse courses</Link>
        </Button>
      </div>

      {enrollments.length === 0 ? (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-sm text-grey-700">You&apos;re not enrolled in any courses yet.</p>
          <Button asChild>
            <Link href="/courses">Find a course</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {enrollments.map((enrollment) => {
            const total = enrollment.course.lessons.length;
            const done = enrollment.course.lessons.filter((l) =>
              completedLessonIds.has(l.id)
            ).length;
            const percent = total ? (done / total) * 100 : enrollment.status === "COMPLETED" ? 100 : 0;

            return (
              <Link key={enrollment.id} href={`/courses/${enrollment.course.slug}`}>
                <Card className="flex h-full flex-col gap-3">
                  <div className="flex items-center gap-2">
                    {enrollment.status === "COMPLETED" ? (
                      <Badge variant="success">Completed</Badge>
                    ) : (
                      <Badge variant="accent">In progress</Badge>
                    )}
                    {enrollment.course.program ? (
                      <Badge variant="neutral">{enrollment.course.program.name}</Badge>
                    ) : null}
                  </div>
                  <CardTitle>{enrollment.course.title}</CardTitle>
                  {total > 0 ? <ProgressBar percent={percent} /> : null}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </Container>
  );
}
