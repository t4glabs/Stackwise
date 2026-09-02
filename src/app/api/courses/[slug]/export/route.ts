import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrimaryOrganization } from "@/lib/org";
import { getFlags } from "@/lib/flags";
import { getPage, bookstackIsConfigured } from "@/lib/bookstack";
import { generateWorkbookDocx } from "@/lib/workbook-export";
import { slugify } from "@/lib/slugify";

// GET /api/courses/[slug]/export            -> whole course as one .docx
// GET /api/courses/[slug]/export?chapter=12 -> just that chapter (bookstackChapterId)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const org = await getPrimaryOrganization();

  const course = await prisma.course.findUnique({
    where: { organizationId_slug: { organizationId: org.id, slug } },
    include: { lessons: { orderBy: { order: "asc" } } },
  });

  if (!course || !course.published || !course.downloadableWorkbook || course.type === "EXTERNAL_LINK") {
    return new Response("Not found", { status: 404 });
  }

  const flags = await getFlags(org.id);
  if (!flags.public_catalog) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=/courses/${slug}`, request.url));
    }
  }

  if (!bookstackIsConfigured()) {
    return new Response("Downloads aren't available right now — BookStack isn't connected.", {
      status: 503,
    });
  }

  const chapterParam = new URL(request.url).searchParams.get("chapter");
  const lessons = chapterParam
    ? course.lessons.filter((l) => String(l.bookstackChapterId) === chapterParam)
    : course.lessons;

  if (lessons.length === 0) {
    return new Response("Nothing to export", { status: 404 });
  }

  const docTitle = chapterParam ? (lessons[0].chapterTitle ?? course.title) : course.title;

  const sections = await Promise.all(
    lessons.map(async (lesson) => {
      const page = await getPage(lesson.bookstackPageId);
      // Chapter headings are only meaningful in the whole-course doc — a single
      // chapter's own export is already titled by that chapter's name, and its
      // description goes in the doc intro instead (see introHtml below).
      return {
        heading: lesson.title,
        chapterTitle: chapterParam ? null : lesson.chapterTitle,
        chapterDescriptionHtml: chapterParam ? null : lesson.chapterDescriptionHtml,
        html: page.html,
      };
    })
  );

  const introHtml = chapterParam ? (lessons[0].chapterDescriptionHtml ?? null) : null;
  const buffer = await generateWorkbookDocx(docTitle, sections, introHtml);
  const filenameBase = chapterParam ? `${course.slug}-${slugify(docTitle)}` : course.slug;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filenameBase}.docx"`,
    },
  });
}
