import { prisma } from "@/lib/prisma";
import { getBook, getChapter, listAllBooks, bookstackIsConfigured } from "@/lib/bookstack";
import { parseCourseTags } from "@/lib/tags";
import { slugify } from "@/lib/slugify";
import { logEvent } from "@/lib/log";
import type { Organization } from "../generated/prisma/client";

export type SyncResult = {
  ranAt: string;
  configured: boolean;
  booksScanned: number;
  newlyDiscovered: number;
};

// Pulls every BookStack book and makes sure a Course row exists for each one — newly
// discovered books are hidden from the catalog by default (published: false) so an
// admin can review them in /admin/courses before anything goes live. Only *content*
// fields (title, description, cover, lessons) are refreshed on repeat syncs; LMS
// configuration (published, type, program, duration, facilitators) is owned by our own
// DB from the moment a course is first discovered — see the architecture note in
// src/lib/tags.ts. Page/lesson bodies are never stored here, only fetched live.
export async function syncCourses(org: Organization): Promise<SyncResult> {
  if (!bookstackIsConfigured()) {
    return { ranAt: new Date().toISOString(), configured: false, booksScanned: 0, newlyDiscovered: 0 };
  }

  const summaries = await listAllBooks();
  let newlyDiscovered = 0;

  for (const summary of summaries) {
    try {
      if (await syncOneBook(org, summary.id)) newlyDiscovered += 1;
    } catch (error) {
      // One book failing (a transient API error, or one deleted on the BookStack side
      // between listAllBooks() and this fetch) used to abort the whole run, silently
      // leaving every book after it in the list un-synced. Log and move on instead —
      // the next scheduled/webhook sync will pick it back up.
      await logEvent({
        organizationId: org.id,
        type: "SYNC",
        level: "ERROR",
        message: `Failed to sync book ${summary.id} ("${summary.name}")`,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ranAt: new Date().toISOString(),
    configured: true,
    booksScanned: summaries.length,
    newlyDiscovered,
  };
}

// Returns true if this was a newly-discovered book (a Course row didn't already exist
// for it).
async function syncOneBook(org: Organization, bookId: number): Promise<boolean> {
  const book = await getBook(bookId);
  const existing = await prisma.course.findUnique({
    where: { organizationId_bookstackBookId: { organizationId: org.id, bookstackBookId: book.id } },
  });

  let courseId: string;

  if (!existing) {
    // First time we've seen this book — use any pre-existing lms_* tags as a
    // starting point (handy if tags were set before this admin UI existed), then
    // the admin takes over from here via /admin/courses.
    const meta = parseCourseTags(book.tags);

    let programId: string | null = null;
    if (meta.program) {
      const program = await prisma.program.upsert({
        where: { organizationId_slug: { organizationId: org.id, slug: slugify(meta.program) } },
        create: { organizationId: org.id, name: meta.program, slug: slugify(meta.program) },
        update: {},
      });
      programId = program.id;
    }

    // upsert, not create — the webhook and the cron backstop (see api/sync/route.ts)
    // can both be mid-sync for the same org at once; two concurrent `!existing`
    // branches racing to `create` the same book would have the second one crash on
    // the organizationId_bookstackBookId unique constraint instead of just no-oping.
    const course = await prisma.course.upsert({
      where: { organizationId_bookstackBookId: { organizationId: org.id, bookstackBookId: book.id } },
      create: {
        organizationId: org.id,
        bookstackBookId: book.id,
        slug: book.slug,
        title: book.name,
        description: book.description || null,
        coverImageUrl: book.cover?.url ?? null,
        programId,
        type: meta.type,
        externalUrl: meta.externalUrl,
        durationLabel: meta.durationLabel,
        order: meta.order,
        published: meta.publish,
        downloadableWorkbook: meta.downloadable,
        certificateEnabled: meta.certificate,
        lastSyncedAt: new Date(),
      },
      update: {
        title: book.name,
        description: book.description || null,
        coverImageUrl: book.cover?.url ?? null,
        lastSyncedAt: new Date(),
      },
    });
    courseId = course.id;
  } else {
    await prisma.course.update({
      where: { id: existing.id },
      data: {
        title: book.name,
        description: book.description || null,
        coverImageUrl: book.cover?.url ?? null,
        lastSyncedAt: new Date(),
      },
    });
    courseId = existing.id;
  }

  // Flatten chapters into lessons: a page directly on the book, or a page inside a chapter.
  // The chapter's own name and intro description ride along on every page in that
  // chapter (denormalized, same pattern as chapterTitle) so a learner sees chapter
  // framing the moment they land on its first page — see chapterDescriptionHtml on
  // the Lesson model. One extra API call per chapter, not per page.
  let order = 0;
  for (const item of book.contents) {
    if (item.type === "page") {
      await upsertLesson(courseId, item.id, null, null, null, item.name, item.slug, order++);
    } else {
      const chapter = await getChapter(item.id);
      const description = chapter.description_html || null;
      for (const page of item.pages) {
        await upsertLesson(courseId, page.id, item.id, item.name, description, page.name, page.slug, order++);
      }
    }
  }

  return !existing;
}

async function upsertLesson(
  courseId: string,
  bookstackPageId: number,
  bookstackChapterId: number | null,
  chapterTitle: string | null,
  chapterDescriptionHtml: string | null,
  title: string,
  slug: string,
  order: number
) {
  await prisma.lesson.upsert({
    where: { courseId_bookstackPageId: { courseId, bookstackPageId } },
    create: {
      courseId,
      bookstackPageId,
      bookstackChapterId,
      chapterTitle,
      chapterDescriptionHtml,
      title,
      slug,
      order,
    },
    update: { title, slug, order, bookstackChapterId, chapterTitle, chapterDescriptionHtml },
  });
}
