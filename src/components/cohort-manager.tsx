"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createCohortAction, deleteCohortAction } from "@/lib/actions/cohort-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Users, X } from "lucide-react";

export type CohortSummary = {
  id: string;
  name: string;
  facilitatorName: string | null;
  startDate: string | null;
  endDate: string | null;
  // Scoped to *this* course — a cohort's org-wide totals live on /admin/cohorts.
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
  coursePath,
  cohorts,
  allCohorts,
  isAdmin,
}: {
  coursePath: string;
  // Cohorts with at least one enrollment in *this* course — what this panel manages.
  cohorts: CohortSummary[];
  // Every cohort in the org, for the "reuse an existing one" name suggestion — a
  // cohort created from a different course shows up here too, since cohorts aren't
  // owned by any single course anymore.
  allCohorts: { id: string; name: string }[];
  isAdmin: boolean;
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
        {/* div, not p — InfoTooltip's popover renders a div, invalid inside a p (see
            DESIGN_SYSTEM.md's InfoTooltip note) */}
        <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          Cohorts
          <InfoTooltip label="What is a cohort?">
            <p>
              A cohort is a standing group of learners — usually a batch, partner group, or
              location (e.g. &quot;March 2026 Batch&quot;). This panel shows which cohorts
              currently have someone enrolled here, from an enroll-time tag only — it&apos;s not
              where members are actually added.
            </p>
            <p className="mt-2">
              To add real members (which auto-enrolls them in whatever courses that cohort
              follows, this one included), or to see the full org-wide picture across every
              course, go to <span className="font-medium text-ink">Admin → Cohorts</span> instead.
            </p>
            <p className="mt-2">
              By itself, a cohort restricts nothing. Optionally, a facilitator can be scoped to
              one or more cohorts (from that facilitator&apos;s own page) so they only see that
              cohort&apos;s members — set up separately, not from here.
            </p>
          </InfoTooltip>
        </div>
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
          No one&apos;s been enrolled here with a cohort yet — pick one when enrolling a learner
          below (org-wide, from any course), or add a brand new one. See the (i) above for how
          that works.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-grey-200 rounded-control border border-grey-200 bg-white">
          {cohorts.map((cohort) => (
            <CohortRow key={cohort.id} cohort={cohort} coursePath={coursePath} isAdmin={isAdmin} />
          ))}
        </ul>
      )}

      {!showAdd ? (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="self-start text-xs font-medium text-accent hover:underline"
        >
          + Add or reuse a cohort
        </button>
      ) : (
        <AddCohortForm
          coursePath={coursePath}
          allCohorts={allCohorts}
          onDone={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function CohortRow({
  cohort,
  coursePath,
  isAdmin,
}: {
  cohort: CohortSummary;
  coursePath: string;
  isAdmin: boolean;
}) {
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
      {isAdmin ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              // Admin-only, and this deletes the cohort org-wide (see
              // deleteCohortAction) — not just unlinking it from this course.
              const result = await deleteCohortAction(cohort.id, coursePath);
              if (result && !result.ok) setError(result.error);
            })
          }
          className="shrink-0 text-grey-500 hover:text-danger disabled:opacity-50"
          aria-label={`Delete ${cohort.name} everywhere`}
          title="Deletes this cohort for every course, not just this one"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </li>
  );
}

// Exported so /admin/cohorts (the org-wide rollup) can reuse the exact same
// create-or-reuse form as the per-course panel, instead of a second implementation.
export function AddCohortForm({
  coursePath,
  allCohorts,
  onDone,
}: {
  coursePath: string;
  allCohorts: { id: string; name: string }[];
  onDone: () => void;
}) {
  const action = createCohortAction.bind(null, coursePath);
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
        <Input
          id="cohort-name"
          name="name"
          placeholder="e.g. March 2026 Batch"
          list="existing-cohort-names"
          required
        />
        <datalist id="existing-cohort-names">
          {allCohorts.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        {allCohorts.length > 0 ? (
          <p className="text-xs text-grey-500">
            Start typing to see cohorts that already exist — matching the exact name reuses it
            instead of creating a near-duplicate. Every cohort is already selectable below when
            enrolling a learner into this course; this is only for creating a brand new one.
          </p>
        ) : null}
      </div>

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
        {pending ? "Saving…" : "Add or reuse cohort"}
      </Button>
    </form>
  );
}
