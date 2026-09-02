import { prisma } from "@/lib/prisma";
import { getBook, listAllBooks, bookstackIsConfigured } from "@/lib/bookstack";
import { parseCourseTags } from "@/lib/tags";
import { slugify } from "@/lib/slugify";
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
    const book = await getBook(summary.id);
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

      const course = await prisma.course.create({
        data: {
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
          lastSyncedAt: new Date(),
        },
      });
      courseId = course.id;
      newlyDiscovered += 1;
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
    // The chapter's own name rides along purely to label per-chapter workbook downloads.
    let order = 0;
    for (const item of book.contents) {
      if (item.type === "page") {
        await upsertLesson(courseId, item.id, null, null, item.name, item.slug, order++);
      } else {
        for (const page of item.pages) {
          await upsertLesson(courseId, page.id, item.id, item.name, page.name, page.slug, order++);
        }
      }
    }
  }

  return {
    ranAt: new Date().toISOString(),
    configured: true,
    booksScanned: summaries.length,
    newlyDiscovered,
  };
}

async function upsertLesson(
  courseId: string,
  bookstackPageId: number,
  bookstackChapterId: number | null,
  chapterTitle: string | null,
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
      title,
      slug,
      order,
    },
    update: { title, slug, order, bookstackChapterId, chapterTitle },
  });
}
