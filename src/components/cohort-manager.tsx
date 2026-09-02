"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createCohortAction, deleteCohortAction } from "@/lib/actions/cohort-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, X } from "lucide-react";

export type CohortSummary = {
  id: string;
  name: string;
  facilitatorName: string | null;
  startDate: string | null;
  endDate: string | null;
  enrolledCount: number;
  completedCount: number;
};

function formatRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return start ? `From ${fmt(start)}` : `Until ${fmt(end!)}`;
}

export function CohortManager({
  courseId,
  coursePath,
  cohorts,
  allFacilitators,
}: {
  courseId: string;
  coursePath: string;
  cohorts: CohortSummary[];
  allFacilitators: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Users className="size-4" /> Manage cohorts
        {cohorts.length > 0 ? ` (${cohorts.length})` : ""}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-grey-200 bg-grey-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Cohorts</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setShowAdd(false);
          }}
          className="text-xs font-medium text-grey-600 hover:text-ink"
        >
          Close
        </button>
      </div>

      {cohorts.length === 0 ? (
        <p className="text-xs text-grey-600">
          No cohorts yet — a cohort is just a named batch (e.g. &quot;March 2026&quot;) you can
          put learners into when enrolling them, useful for tracking a group separately.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-grey-200 rounded-control border border-grey-200 bg-white">
          {cohorts.map((cohort) => (
            <CohortRow key={cohort.id} cohort={cohort} coursePath={coursePath} />
          ))}
        </ul>
      )}

      {!showAdd ? (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="self-start text-xs font-medium text-accent hover:underline"
        >
          + Add a cohort
        </button>
      ) : (
        <AddCohortForm
          courseId={courseId}
          coursePath={coursePath}
          allFacilitators={allFacilitators}
          onDone={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function CohortRow({ cohort, coursePath }: { cohort: CohortSummary; coursePath: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const range = formatRange(cohort.startDate, cohort.endDate);

  return (
    <li className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-ink">{cohort.name}</span>
        <span className="truncate text-xs text-grey-500">
          {cohort.enrolledCount} enrolled, {cohort.completedCount} completed
          {cohort.facilitatorName ? ` · ${cohort.facilitatorName}` : ""}
          {range ? ` · ${range}` : ""}
        </span>
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteCohortAction(cohort.id, coursePath);
            if (result && !result.ok) setError(result.error);
          })
        }
        className="shrink-0 text-grey-500 hover:text-danger disabled:opacity-50"
        aria-label={`Delete ${cohort.name}`}
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

function AddCohortForm({
  courseId,
  coursePath,
  allFacilitators,
  onDone,
}: {
  courseId: string;
  coursePath: string;
  allFacilitators: { id: string; name: string }[];
  onDone: () => void;
}) {
  const action = createCohortAction.bind(null, courseId, coursePath);
  const [state, formAction, pending] = useActionState(action, undefined);

  // Collapsing the form is a side effect of a successful submit, not something to do
  // mid-render — calling a parent setState while this component renders is exactly
  // the "Cannot update a component while rendering a different component" React error.
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-2.5 border-t border-grey-200 pt-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="cohort-name" className="text-xs">
          Name
        </Label>
        <Input id="cohort-name" name="name" placeholder="e.g. March 2026 Batch" required />
      </div>

      {allFacilitators.length > 0 ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="cohort-facilitator" className="text-xs">
            Facilitator (optional)
          </Label>
          <select
            id="cohort-facilitator"
            name="facilitatorId"
            className="h-9 rounded-control border border-grey-200 bg-white px-3 text-sm text-ink"
          >
            <option value="">None</option>
            {allFacilitators.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="cohort-start" className="text-xs">
            Start (optional)
          </Label>
          <Input id="cohort-start" name="startDate" type="date" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="cohort-end" className="text-xs">
            End (optional)
          </Label>
          <Input id="cohort-end" name="endDate" type="date" />
        </div>
      </div>

      {state && !state.ok ? <p className="text-xs text-danger">{state.error}</p> : null}
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Adding…" : "Add cohort"}
      </Button>
    </form>
  );
}
