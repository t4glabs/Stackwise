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
import { WorkbookDownloads, type WorkbookChapter } from "@/components/workbook-downloads";
import { wrapTablesForScroll } from "@/lib/html";
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

  const certificate =
    session?.user && enrollment?.status === "COMPLETED" && flags.certificates && course.certificateEnabled
      ? await prisma.certificate.findUnique({
          where: { learnerId_courseId: { learnerId: session.user.id, courseId: course.id } },
        })
      : null;

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

      {certificate ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent/20 bg-accent-soft p-6">
          <div>
            <Eyebrow className="mb-1.5 text-accent">Completed</Eyebrow>
            <p className="text-sm text-ink">You&apos;ve earned a certificate for this course.</p>
          </div>
          <Button variant="accent" asChild>
            <Link href={`/certificates/${certificate.id}`} target="_blank">
              View certificate
            </Link>
          </Button>
        </div>
      ) : null}

      {course.downloadableWorkbook ? (
        <WorkbookDownloads slug={slug} chapters={getWorkbookChapters(course.lessons)} />
      ) : null}
    </Container>
  );
}

function getWorkbookChapters(
  lessons: { bookstackChapterId: number | null; chapterTitle: string | null }[]
): WorkbookChapter[] {
  const chapters: WorkbookChapter[] = [];
  const seen = new Set<number>();
  for (const lesson of lessons) {
    if (lesson.bookstackChapterId != null && !seen.has(lesson.bookstackChapterId)) {
      seen.add(lesson.bookstackChapterId);
      chapters.push({ id: lesson.bookstackChapterId, title: lesson.chapterTitle ?? "Untitled chapter" });
    }
  }
  return chapters;
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

type SyllabusLesson = {
  id: string;
  title: string;
  slug: string;
  bookstackChapterId: number | null;
  chapterTitle: string | null;
  chapterDescriptionHtml: string | null;
};

// Consecutive lessons sharing a chapter (sync.ts always emits a chapter's pages
// together, so a simple run-length grouping is enough — no need to merge
// non-adjacent runs of the same chapter). Lessons with no chapter render standalone,
// so a course with no BookStack chapters at all still renders as a flat list.
type SyllabusBlock =
  | { type: "lesson"; lesson: SyllabusLesson }
  | { type: "chapter"; chapterTitle: string; chapterDescriptionHtml: string | null; lessons: SyllabusLesson[] };

function groupSyllabus(lessons: SyllabusLesson[]): SyllabusBlock[] {
  const blocks: SyllabusBlock[] = [];
  for (const lesson of lessons) {
    if (lesson.bookstackChapterId == null) {
      blocks.push({ type: "lesson", lesson });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last?.type === "chapter" && last.lessons[0]?.bookstackChapterId === lesson.bookstackChapterId) {
      last.lessons.push(lesson);
    } else {
      blocks.push({
        type: "chapter",
        chapterTitle: lesson.chapterTitle ?? "Untitled chapter",
        chapterDescriptionHtml: lesson.chapterDescriptionHtml,
        lessons: [lesson],
      });
    }
  }
  return blocks;
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
  lessons: SyllabusLesson[];
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
        <SyllabusList
          lessons={lessons}
          progressByLesson={progressByLesson}
          enrolled={enrolled}
          coursePath={coursePath}
          slug={slug}
        />
      </div>
    </div>
  );
}

// Renders the 2-level chapter/page structure: a chapter header row (not a link) above
// its pages, indented slightly to read as a group. Lesson numbering stays continuous
// across the whole course — it matches the "Lesson N of M" counter on the lesson page
// itself — chapter grouping is a visual aid layered on top, not a renumbering.
function SyllabusList({
  lessons,
  progressByLesson,
  enrolled,
  coursePath,
  slug,
}: {
  lessons: SyllabusLesson[];
  progressByLesson: Map<string, { completedAt: Date | null }>;
  enrolled: boolean;
  coursePath: string;
  slug: string;
}) {
  const blocks = groupSyllabus(lessons);
  // Lessons already come in global course order, so their position in the flat
  // array is the same 1-based number shown on the lesson page itself ("Lesson N of
  // M") — no separate counter to keep in sync during render.
  const indexById = new Map(lessons.map((lesson, i) => [lesson.id, i + 1]));

  return (
    <div className="flex flex-col divide-y divide-grey-200 overflow-hidden rounded-card border border-grey-200 bg-white">
      {blocks.map((block, i) => {
        if (block.type === "lesson") {
          return (
            <SyllabusRow
              key={block.lesson.id}
              lesson={block.lesson}
              index={indexById.get(block.lesson.id)!}
              done={Boolean(progressByLesson.get(block.lesson.id)?.completedAt)}
              enrolled={enrolled}
              coursePath={coursePath}
              slug={slug}
            />
          );
        }
        return (
          <div key={`chapter-${i}`} className="flex flex-col">
            <div className="flex flex-col gap-1 bg-grey-50 px-5 py-3">
              <p className="text-[13px] font-semibold text-grey-700">{block.chapterTitle}</p>
              {block.chapterDescriptionHtml ? (
                <div
                  className="prose prose-sm max-w-none text-[13px] leading-relaxed text-grey-600 prose-p:my-0"
                  dangerouslySetInnerHTML={{ __html: wrapTablesForScroll(block.chapterDescriptionHtml) }}
                />
              ) : null}
            </div>
            <div className="flex flex-col divide-y divide-grey-200">
              {block.lessons.map((lesson) => {
                return (
                  <SyllabusRow
                    key={lesson.id}
                    lesson={lesson}
                    index={indexById.get(lesson.id)!}
                    done={Boolean(progressByLesson.get(lesson.id)?.completedAt)}
                    enrolled={enrolled}
                    coursePath={coursePath}
                    slug={slug}
                    indent
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SyllabusRow({
  lesson,
  index,
  done,
  enrolled,
  coursePath,
  slug,
  indent,
}: {
  lesson: SyllabusLesson;
  index: number;
  done: boolean;
  enrolled: boolean;
  coursePath: string;
  slug: string;
  indent?: boolean;
}) {
  return (
    <Link
      href={enrolled ? `/courses/${slug}/lessons/${lesson.slug}` : coursePath}
      className={`flex items-center gap-4 py-4 text-[15px] transition-colors hover:bg-grey-50 ${indent ? "pl-9 pr-5" : "px-5"}`}
    >
      {done ? (
        <CheckCircle2 className="size-[18px] shrink-0 text-success" />
      ) : (
        <Circle className="size-[18px] shrink-0 text-grey-300" />
      )}
      <span className="font-mono text-[13px] tabular-nums text-grey-400">
        {String(index).padStart(2, "0")}
      </span>
      <span className="text-ink">{lesson.title}</span>
    </Link>
  );
}
