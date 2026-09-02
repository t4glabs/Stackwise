"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, ChevronDown } from "lucide-react";

export type WorkbookChapter = { id: number; title: string };

// A quiet, collapsed-by-default utility — offline download is secondary to actually
// taking the course, so it shouldn't compete with the enroll CTA or syllabus for
// attention at the top of the page. Lives after the syllabus and stays out of the
// way until a learner asks for it.
export function WorkbookDownloads({ slug, chapters }: { slug: string; chapters: WorkbookChapter[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-stone-200 pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
          <Download className="size-4 text-stone-500" />
          Download for offline use (.docx)
        </span>
        <ChevronDown className={`size-4 shrink-0 text-stone-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-[13px] text-stone-600">
            Fill in and share back — no internet needed.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/courses/${slug}/export`}>
                <Download className="size-4" /> Whole course
              </a>
            </Button>
            {chapters.map((chapter) => (
              <Button key={chapter.id} variant="outline" size="sm" asChild>
                <a href={`/api/courses/${slug}/export?chapter=${chapter.id}`}>
                  <Download className="size-4" /> {chapter.title}
                </a>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
