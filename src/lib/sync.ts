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
  hidden: number;
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
    return { ranAt: new Date().toISOString(), configured: false, booksScanned: 0, newlyDiscovered: 0, hidden: 0 };
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

  // A book no longer in BookStack's own list gets unpublished, not deleted — an
  // enrollment or certificate may already point at it, and there's no cascade set up
  // to clean those up safely. Never touch anything if the list came back empty: an
  // org that already has courses reporting zero books is almost certainly a transient
  // API hiccup, not "someone deleted everything," and treating it as the latter would
  // unpublish the whole catalog on a fluke.
  let hidden = 0;
  if (summaries.length > 0) {
    const seenBookIds = summaries.map((s) => s.id);
    const result = await prisma.course.updateMany({
      where: { organizationId: org.id, published: true, bookstackBookId: { notIn: seenBookIds } },
      data: { published: false },
    });
    hidden = result.count;
    if (hidden > 0) {
      await logEvent({
        organizationId: org.id,
        type: "SYNC",
        level: "INFO",
        message: `Unpublished ${hidden} course${hidden === 1 ? "" : "s"} whose book no longer exists in BookStack`,
      });
    }
  }

  return {
    ranAt: new Date().toISOString(),
    configured: true,
    booksScanned: summaries.length,
    newlyDiscovered,
    hidden,
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
  const seenPageIds: number[] = [];
  for (const item of book.contents) {
    if (item.type === "page") {
      seenPageIds.push(item.id);
      await upsertLesson(courseId, item.id, null, null, null, item.name, item.slug, order++);
    } else {
      const chapter = await getChapter(item.id);
      const description = chapter.description_html || null;
      for (const page of item.pages) {
        seenPageIds.push(page.id);
        await upsertLesson(courseId, page.id, item.id, item.name, description, page.name, page.slug, order++);
      }
    }
  }

  // A page removed from within a book that's still otherwise here — same reasoning as
  // the book-level unpublish above: hide it (a learner may already have Progress
  // against it), don't delete it. book.contents is a full, direct listing of this
  // specific book's current pages, not a suspect empty response, so unlike the
  // all-books case there's no "might just be an API hiccup" ambiguity to guard
  // against — a book that now genuinely has zero pages should hide all of them.
  await prisma.lesson.updateMany({
    where: { courseId, hidden: false, bookstackPageId: { notIn: seenPageIds } },
    data: { hidden: true },
  });

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
    // hidden: false — a page that comes back after being hidden un-hides on its own,
    // no admin review needed (unlike a course's `published`, this isn't an
    // admin-owned setting, it's purely "does the sync currently see this page").
    update: { title, slug, order, bookstackChapterId, chapterTitle, chapterDescriptionHtml, hidden: false },
  });
}
