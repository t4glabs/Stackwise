import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  SELF_PACED: "Self-paced",
  FACILITATED: "Facilitated",
  EXTERNAL_LINK: "External course",
};

// Designed to sit inside a `grid gap-px bg-stone-200` wrapper (see CourseGrid) — the
// 1px gap shows the parent's background through, forming shared hairlines between
// cards instead of doubled-up borders. The card itself carries no border of its own.
export function CourseCard({
  slug,
  title,
  description,
  type,
  durationLabel,
  programName,
}: {
  slug: string;
  title: string;
  description: string | null;
  type: string;
  durationLabel: string | null;
  programName?: string | null;
}) {
  return (
    <Link
      href={`/courses/${slug}`}
      className="group flex h-full flex-col gap-3 bg-cream p-6 transition-colors hover:bg-white"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="accent">{TYPE_LABEL[type] ?? type}</Badge>
        {programName ? <Badge pill>{programName}</Badge> : null}
        {durationLabel ? <Badge pill>{durationLabel}</Badge> : null}
      </div>
      <h3 className="flex items-start justify-between gap-2 text-[18px] font-semibold leading-snug text-ink">
        {title}
        <ArrowUpRight className="mt-1 size-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent" />
      </h3>
      {description ? (
        <p className="line-clamp-3 font-serif text-[15px] leading-relaxed text-stone-600">
          {description}
        </p>
      ) : null}
    </Link>
  );
}

export function CourseGrid({ children }: { children: React.ReactNode }) {
  return (
    // auto-fit (not auto-fill) collapses any unused trailing columns to 0 width, so a
    // lone card fills the row instead of leaving an empty, still-colored grid cell.
    <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-px overflow-hidden rounded-card border border-stone-200 bg-stone-200">
      {children}
    </div>
  );
}
