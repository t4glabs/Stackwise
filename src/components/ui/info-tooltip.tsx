"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// A click-to-open "i" button for explaining a concept inline, right where someone
// hits it — for things worth a paragraph and an example, not a one-line label. No
// Radix Popover in this project yet, and this doesn't need one: a plain toggle plus
// click-outside-to-close covers it.
export function InfoTooltip({
  children,
  label = "More info",
  panelClassName,
}: {
  children: React.ReactNode;
  label?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-grey-400 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grey-600/40"
      >
        <Info className="size-full" />
      </button>
      {open ? (
        <div
          role="tooltip"
          className={cn(
            // normal-case/font-normal/tracking-normal: this gets placed inside all
            // sorts of ancestors (uppercase table headers, bold labels) whose text
            // styling would otherwise cascade into the panel — reset explicitly
            // rather than fighting inherited transforms per call site.
            "absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-card border border-grey-200 bg-white p-3.5 text-xs font-normal normal-case tracking-normal leading-relaxed text-grey-700 shadow-lg",
            panelClassName
          )}
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}
