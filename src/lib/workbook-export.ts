import HtmlToDocx from "@turbodocx/html-to-docx";

export type ExportSection = { heading: string; html: string };

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// One heading per BookStack page, a page break between them so each lesson starts
// clean when printed. Remote <img> URLs (BookStack's own) are fetched automatically
// by the docx library — nothing to pre-download here.
function buildWorkbookHtml(title: string, sections: ExportSection[]): string {
  const body = sections
    .map(
      (section, i) => `
        ${i > 0 ? '<div style="page-break-before: always;"></div>' : ""}
        <h2>${escapeHtml(section.heading)}</h2>
        ${section.html}
      `
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${escapeHtml(title)}</title></head>
<body>
<h1>${escapeHtml(title)}</h1>
${body}
</body>
</html>`;
}

export async function generateWorkbookDocx(title: string, sections: ExportSection[]): Promise<Buffer> {
  const html = buildWorkbookHtml(title, sections);
  const result = await HtmlToDocx(html, null, {
    title,
    creator: "WeLive Learning",
    pageNumber: true,
  });
  return Buffer.isBuffer(result) ? result : Buffer.from(result as ArrayBuffer);
}
