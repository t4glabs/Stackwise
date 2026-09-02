import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrimaryOrganization } from "@/lib/org";
import { getPage, bookstackIsConfigured } from "@/lib/bookstack";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { markLessonComplete } from "@/lib/actions/enrollment-actions";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug } = await params;
  const org = await getPrimaryOrganization();
  const session = await auth();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/courses/${slug}/lessons/${lessonSlug}`);
  }

  const course = await prisma.course.findUnique({
    where: { organizationId_slug: { organizationId: org.id, slug } },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  if (!course) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { learnerId_courseId: { learnerId: session.user.id, courseId: course.id } },
  });
  if (!enrollment) redirect(`/courses/${slug}`);

  const lessonIndex = course.lessons.findIndex((l) => l.slug === lessonSlug);
  const lesson = course.lessons[lessonIndex];
  if (!lesson) notFound();

  const progress = await prisma.progress.findUnique({
    where: { learnerId_lessonId: { learnerId: session.user.id, lessonId: lesson.id } },
  });

  const html = bookstackIsConfigured()
    ? (await getPage(lesson.bookstackPageId)).html
    : `<p><em>Connect a BookStack API token in .env to display real lesson content here — see DEPLOY.md. This is placeholder text for "${lesson.title}".</em></p>`;

  const coursePath = `/courses/${slug}`;
  const prevLesson = course.lessons[lessonIndex - 1];
  const nextLesson = course.lessons[lessonIndex + 1];

  // True the moment a learner steps into a new chapter — either it's the very first
  // lesson of the course, or the chapter differs from the one they were just reading.
  // That's the exact spot the chapter's own BookStack description belongs: framing
  // for the session that's about to start, not buried in the syllabus they've
  // already scrolled past.
  const isChapterStart =
    lesson.bookstackChapterId != null && prevLesson?.bookstackChapterId !== lesson.bookstackChapterId;

  return (
    <Container className="flex max-w-[720px] flex-col gap-10 py-16">
      <Link
        href={coursePath}
        className="flex w-fit items-center gap-1.5 text-[14px] font-medium text-stone-600 hover:text-ink"
      >
        <ArrowLeft className="size-4" /> {course.title}
      </Link>

      {isChapterStart ? (
        <div className="flex flex-col gap-2 rounded-card border border-accent/20 bg-accent-soft p-6">
          <Eyebrow>Starting {lesson.chapterTitle}</Eyebrow>
          {lesson.chapterDescriptionHtml ? (
            <div
              className="prose max-w-none font-serif text-[15px] leading-relaxed text-ink prose-p:my-0"
              dangerouslySetInnerHTML={{ __html: lesson.chapterDescriptionHtml }}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-b border-stone-200 pb-8">
        <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-grey-400">
          {lesson.chapterTitle ? `${lesson.chapterTitle} · ` : ""}Lesson {lessonIndex + 1} of {course.lessons.length}
        </span>
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink">
          {lesson.title}
        </h1>
      </div>

      <article
        className="prose max-w-none font-serif text-[16px] leading-relaxed text-ink prose-headings:font-sans prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-accent prose-strong:text-ink prose-img:rounded-card"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-8">
        {prevLesson ? (
          <Button variant="outline" asChild>
            <Link href={`/courses/${slug}/lessons/${prevLesson.slug}`}>
              <ArrowLeft className="size-4" /> Previous
            </Link>
          </Button>
        ) : (
          <span />
        )}

        {progress?.completedAt ? (
          <span className="flex items-center gap-1.5 text-[14px] font-medium text-success">
            <CheckCircle2 className="size-4" /> Completed
          </span>
        ) : (
          <form action={markLessonComplete.bind(null, lesson.id, coursePath)}>
            <Button variant="accent" type="submit">
              Mark complete
            </Button>
          </form>
        )}

        {nextLesson ? (
          <Button variant="outline" asChild>
            <Link href={`/courses/${slug}/lessons/${nextLesson.slug}`}>
              Next <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <span />
        )}
      </div>
    </Container>
  );
}
