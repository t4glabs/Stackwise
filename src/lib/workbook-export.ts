import HtmlToDocx from "@turbodocx/html-to-docx";

export type ExportSection = {
  heading: string;
  chapterTitle: string | null;
  chapterDescriptionHtml: string | null;
  html: string;
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// One heading per BookStack page, a page break between them so each lesson starts
// clean when printed. When a section's chapterTitle differs from the previous one
// (whole-course export only — a single chapter's own export never sets this), an h1
// chapter heading is inserted first, mirroring the 2-level chapter/page structure
// shown in the on-site Syllabus. Remote <img> URLs (BookStack's own) are fetched
// automatically by the docx library — nothing to pre-download here.
function buildWorkbookHtml(title: string, sections: ExportSection[], introHtml: string | null): string {
  let currentChapter: string | null | undefined = undefined;
  const body = sections
    .map((section, i) => {
      const chapterChanged = section.chapterTitle !== currentChapter;
      currentChapter = section.chapterTitle;
      const chapterIntro = chapterChanged && section.chapterTitle
        ? `<h1>${escapeHtml(section.chapterTitle)}</h1>${section.chapterDescriptionHtml ?? ""}`
        : "";
      return `
        ${i > 0 ? '<div style="page-break-before: always;"></div>' : ""}
        ${chapterIntro}
        <h2>${escapeHtml(section.heading)}</h2>
        ${section.html}
      `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${escapeHtml(title)}</title></head>
<body>
<h1>${escapeHtml(title)}</h1>
${introHtml ?? ""}
${body}
</body>
</html>`;
}

export async function generateWorkbookDocx(
  title: string,
  sections: ExportSection[],
  introHtml: string | null = null
): Promise<Buffer> {
  const html = buildWorkbookHtml(title, sections, introHtml);
  const result = await HtmlToDocx(html, null, {
    title,
    creator: "WeLive Learning",
    pageNumber: true,
  });
  return Buffer.isBuffer(result) ? result : Buffer.from(result as ArrayBuffer);
}
