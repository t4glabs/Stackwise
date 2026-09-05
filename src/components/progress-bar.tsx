import { cn } from "@/lib/utils";

export function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  // "0%"/"100%" read as ambiguous at a glance in a long list — "has anyone even
  // opened this?" vs "everyone's done" is the actual question being asked. The
  // number is still there for anything strictly in between.
  const label = clamped === 0 ? "Not started" : clamped === 100 ? "Completed" : `${clamped}%`;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-grey-200">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="whitespace-nowrap font-mono text-xs tabular-nums text-grey-600">{label}</span>
    </div>
  );
}
