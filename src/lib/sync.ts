import { prisma } from "@/lib/prisma";
import { getBook, listAllBooks, bookstackIsConfigured } from "@/lib/bookstack";
import { parseCourseTags } from "@/lib/tags";
import { slugify } from "@/lib/slugify";
import type { Organization } from "../generated/prisma/client";

export type SyncResult = {
  ranAt: string;
  configured: boolean;
  booksScanned: number;
  coursesPublished: number;
  coursesUnpublished: number;
};

// Pulls every BookStack book, reads its lms_* tags, and upserts a Course (+ Program +
// Lessons) for anything tagged lms_publish=true. Page/lesson *content* is never stored
// here — only enough metadata to render a catalog and track progress. Safe to call
// repeatedly: this is what both the webhook receiver and the scheduled poll invoke.
export async function syncCourses(org: Organization): Promise<SyncResult> {
  if (!bookstackIsConfigured()) {
    return {
      ranAt: new Date().toISOString(),
      configured: false,
      booksScanned: 0,
      coursesPublished: 0,
      coursesUnpublished: 0,
    };
  }

  const summaries = await listAllBooks();
  let published = 0;
  let unpublished = 0;
  const seenBookIds = new Set<number>();

  for (const summary of summaries) {
    const book = await getBook(summary.id);
    const meta = parseCourseTags(book.tags);
    seenBookIds.add(book.id);

    if (!meta.publish) {
      const existing = await prisma.course.findUnique({
        where: { organizationId_bookstackBookId: { organizationId: org.id, bookstackBookId: book.id } },
      });
      if (existing?.published) {
        await prisma.course.update({ where: { id: existing.id }, data: { published: false } });
        unpublished += 1;
      }
      continue;
    }

    let programId: string | null = null;
    if (meta.program) {
      const program = await prisma.program.upsert({
        where: { organizationId_slug: { organizationId: org.id, slug: slugify(meta.program) } },
        create: { organizationId: org.id, name: meta.program, slug: slugify(meta.program) },
        update: { name: meta.program },
      });
      programId = program.id;
    }

    const course = await prisma.course.upsert({
      where: {
        organizationId_bookstackBookId: { organizationId: org.id, bookstackBookId: book.id },
      },
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
        facilitatorEmail: meta.facilitatorEmail,
        durationLabel: meta.durationLabel,
        order: meta.order,
        published: true,
        lastSyncedAt: new Date(),
      },
      update: {
        slug: book.slug,
        title: book.name,
        description: book.description || null,
        coverImageUrl: book.cover?.url ?? null,
        programId,
        type: meta.type,
        externalUrl: meta.externalUrl,
        facilitatorEmail: meta.facilitatorEmail,
        durationLabel: meta.durationLabel,
        order: meta.order,
        published: true,
        lastSyncedAt: new Date(),
      },
    });
    published += 1;

    // Flatten chapters into lessons: a page directly on the book, or a page inside a chapter.
    let order = 0;
    for (const item of book.contents) {
      if (item.type === "page") {
        await upsertLesson(course.id, item.id, null, item.name, item.slug, order++);
      } else {
        for (const page of item.pages) {
          await upsertLesson(course.id, page.id, item.id, page.name, page.slug, order++);
        }
      }
    }
  }

  return {
    ranAt: new Date().toISOString(),
    configured: true,
    booksScanned: summaries.length,
    coursesPublished: published,
    coursesUnpublished: unpublished,
  };
}

async function upsertLesson(
  courseId: string,
  bookstackPageId: number,
  bookstackChapterId: number | null,
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
      title,
      slug,
      order,
    },
    update: { title, slug, order, bookstackChapterId },
  });
}
