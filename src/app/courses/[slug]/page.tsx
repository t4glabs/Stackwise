import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrimaryOrganization } from "@/lib/org";
import { getFlags } from "@/lib/flags";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/progress-bar";
import { enrollInCourse, markCourseComplete } from "@/lib/actions/enrollment-actions";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  SELF_PACED: "Self-paced",
  FACILITATED: "Facilitated",
  EXTERNAL_LINK: "External course",
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getPrimaryOrganization();
  const flags = await getFlags(org.id);
  const session = await auth();

  const course = await prisma.course.findUnique({
    where: { organizationId_slug: { organizationId: org.id, slug } },
    include: {
      program: true,
      lessons: { orderBy: { order: "asc" } },
    },
  });

  if (!course || !course.published) notFound();

  const coursePath = `/courses/${slug}`;

  const enrollment = session?.user
    ? await prisma.enrollment.findUnique({
        where: { learnerId_courseId: { learnerId: session.user.id, courseId: course.id } },
      })
    : null;

  const progressByLesson = session?.user
    ? new Map(
        (
          await prisma.progress.findMany({
            where: { learnerId: session.user.id, lesson: { courseId: course.id } },
          })
        ).map((p) => [p.lessonId, p])
      )
    : new Map();

  const completedCount = [...progressByLesson.values()].filter((p) => p.completedAt).length;
  const percent = course.lessons.length ? (completedCount / course.lessons.length) * 100 : 0;

  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-14">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="accent">{TYPE_LABEL[course.type]}</Badge>
          {course.program ? <Badge variant="neutral">{course.program.name}</Badge> : null}
          {course.durationLabel ? <Badge variant="neutral">{course.durationLabel}</Badge> : null}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-ink text-balance">
          {course.title}
        </h1>
        {course.description ? (
          <p className="text-base text-grey-700">{course.description}</p>
        ) : null}
      </div>

      {course.type === "EXTERNAL_LINK" ? (
        <ExternalCourseAction
          courseId={course.id}
          externalUrl={course.externalUrl}
          coursePath={coursePath}
          loggedIn={Boolean(session?.user)}
          completed={enrollment?.status === "COMPLETED"}
        />
      ) : (
        <SelfOrFacilitatedCourse
          courseId={course.id}
          coursePath={coursePath}
          loggedIn={Boolean(session?.user)}
          enrolled={Boolean(enrollment)}
          selfEnrollmentEnabled={flags.self_enrollment}
          lessons={course.lessons}
          progressByLesson={progressByLesson}
          percent={percent}
          slug={slug}
        />
      )}
    </Container>
  );
}

function ExternalCourseAction({
  courseId,
  externalUrl,
  coursePath,
  loggedIn,
  completed,
}: {
  courseId: string;
  externalUrl: string | null;
  coursePath: string;
  loggedIn: boolean;
  completed: boolean;
}) {
  if (!externalUrl) {
    return <p className="text-sm text-grey-600">No external link has been set for this course yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-grey-200 bg-grey-50 p-6">
      <p className="text-sm text-grey-700">
        This course is hosted externally. It opens in a new tab — come back here and mark it
        complete once you&apos;re done.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <a href={externalUrl} target="_blank" rel="noreferrer">
            Open course <ExternalLink className="size-4" />
          </a>
        </Button>
        {loggedIn ? (
          completed ? (
            <Badge variant="success">Completed</Badge>
          ) : (
            <form action={markCourseComplete.bind(null, courseId, coursePath)}>
              <Button variant="outline" type="submit">
                Mark as complete
              </Button>
            </form>
          )
        ) : (
          <Link href={`/login?callbackUrl=${coursePath}`} className="text-sm font-medium text-accent hover:underline">
            Log in to track your progress
          </Link>
        )}
      </div>
    </div>
  );
}

function SelfOrFacilitatedCourse({
  courseId,
  coursePath,
  loggedIn,
  enrolled,
  selfEnrollmentEnabled,
  lessons,
  progressByLesson,
  percent,
  slug,
}: {
  courseId: string;
  coursePath: string;
  loggedIn: boolean;
  enrolled: boolean;
  selfEnrollmentEnabled: boolean;
  lessons: { id: string; title: string; slug: string }[];
  progressByLesson: Map<string, { completedAt: Date | null }>;
  percent: number;
  slug: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {!loggedIn ? (
        <div className="rounded-card border border-grey-200 bg-grey-50 p-6 text-sm text-grey-700">
          <Link href={`/login?callbackUrl=${coursePath}`} className="font-medium text-accent hover:underline">
            Log in
          </Link>{" "}
          to enroll and track your progress through this course.
        </div>
      ) : !enrolled ? (
        selfEnrollmentEnabled ? (
          <form action={enrollInCourse.bind(null, courseId, coursePath)}>
            <Button type="submit" size="lg">
              Enroll
            </Button>
          </form>
        ) : (
          <p className="text-sm text-grey-600">
            Ask your facilitator to enroll you in this course.
          </p>
        )
      ) : (
        <ProgressBar percent={percent} />
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-grey-600">Syllabus</h2>
        <ol className="flex flex-col divide-y divide-grey-200 rounded-card border border-grey-200 bg-white">
          {lessons.map((lesson, i) => {
            const done = Boolean(progressByLesson.get(lesson.id)?.completedAt);
            return (
              <li key={lesson.id}>
                <Link
                  href={enrolled ? `/courses/${slug}/lessons/${lesson.slug}` : coursePath}
                  className="flex items-center gap-3 px-5 py-3.5 text-sm hover:bg-grey-50"
                >
                  {done ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-grey-400" />
                  )}
                  <span className="font-mono text-xs text-grey-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ink">{lesson.title}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
