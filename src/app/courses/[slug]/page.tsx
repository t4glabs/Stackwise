import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrimaryOrganization } from "@/lib/org";
import { getFlags } from "@/lib/flags";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ProgressBar } from "@/components/progress-bar";
import { enrollInCourse, markCourseComplete } from "@/lib/actions/enrollment-actions";
import { CheckCircle2, Circle, ExternalLink, Download } from "lucide-react";

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
    <Container className="flex max-w-[720px] flex-col gap-10 py-16">
      <div className="flex flex-col gap-4">
        <Eyebrow>{course.program?.name ?? TYPE_LABEL[course.type]}</Eyebrow>
        <h1 className="text-balance text-[36px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink sm:text-[40px]">
          {course.title}
        </h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="accent">{TYPE_LABEL[course.type]}</Badge>
          {course.durationLabel ? <Badge pill>{course.durationLabel}</Badge> : null}
        </div>
        {course.description ? (
          <p className="font-serif text-[17px] leading-relaxed text-stone-600">
            {course.description}
          </p>
        ) : null}
      </div>

      {course.downloadableWorkbook ? (
        <WorkbookDownloads slug={slug} lessons={course.lessons} />
      ) : null}

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

function WorkbookDownloads({
  slug,
  lessons,
}: {
  slug: string;
  lessons: { bookstackChapterId: number | null; chapterTitle: string | null }[];
}) {
  const chapters: { id: number; title: string }[] = [];
  const seen = new Set<number>();
  for (const lesson of lessons) {
    if (lesson.bookstackChapterId != null && !seen.has(lesson.bookstackChapterId)) {
      seen.add(lesson.bookstackChapterId);
      chapters.push({ id: lesson.bookstackChapterId, title: lesson.chapterTitle ?? "Untitled chapter" });
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-stone-200 bg-white p-6">
      <div>
        <Eyebrow className="mb-1.5">Offline use</Eyebrow>
        <p className="text-[15px] text-stone-600">
          Get this as a Word document to fill in and share back — no internet needed.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/courses/${slug}/export`}>
            <Download className="size-4" /> Whole course (.docx)
          </a>
        </Button>
        {chapters.map((chapter) => (
          <Button key={chapter.id} variant="outline" size="sm" asChild>
            <a href={`/api/courses/${slug}/export?chapter=${chapter.id}`}>
              <Download className="size-4" /> {chapter.title} (.docx)
            </a>
          </Button>
        ))}
      </div>
    </div>
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
    return <p className="text-[15px] text-stone-600">No external link has been set for this course yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-stone-200 bg-white p-6">
      <p className="text-[15px] text-stone-600">
        This course is hosted externally. It opens in a new tab — come back here and mark it
        complete once you&apos;re done.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="accent" asChild>
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
          <Link href={`/login?callbackUrl=${coursePath}`} className="text-[14px] font-medium text-accent hover:underline">
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
    <div className="flex flex-col gap-8">
      {!loggedIn ? (
        <div className="rounded-card border border-stone-200 bg-white p-6 text-[15px] text-stone-600">
          <Link href={`/login?callbackUrl=${coursePath}`} className="font-medium text-accent hover:underline">
            Log in
          </Link>{" "}
          to enroll and track your progress through this course.
        </div>
      ) : !enrolled ? (
        selfEnrollmentEnabled ? (
          <form action={enrollInCourse.bind(null, courseId, coursePath)}>
            <Button variant="accent" type="submit" size="lg">
              Enroll
            </Button>
          </form>
        ) : (
          <p className="text-[15px] text-stone-600">
            Ask your facilitator to enroll you in this course.
          </p>
        )
      ) : (
        <div className="rounded-card border border-stone-200 bg-white p-5">
          <ProgressBar percent={percent} />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Eyebrow>Syllabus</Eyebrow>
        <ol className="flex flex-col divide-y divide-grey-200 overflow-hidden rounded-card border border-grey-200 bg-white">
          {lessons.map((lesson, i) => {
            const done = Boolean(progressByLesson.get(lesson.id)?.completedAt);
            return (
              <li key={lesson.id}>
                <Link
                  href={enrolled ? `/courses/${slug}/lessons/${lesson.slug}` : coursePath}
                  className="flex items-center gap-4 px-5 py-4 text-[15px] transition-colors hover:bg-grey-50"
                >
                  {done ? (
                    <CheckCircle2 className="size-[18px] shrink-0 text-success" />
                  ) : (
                    <Circle className="size-[18px] shrink-0 text-grey-300" />
                  )}
                  <span className="font-mono text-[13px] tabular-nums text-grey-400">
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
