"use client";

import { useState, useTransition } from "react";
import { linkCohortFacilitatorAction, unlinkCohortFacilitatorAction } from "@/lib/actions/cohort-facilitator-actions";
import { Switch } from "@/components/ui/switch";

export function FacilitatorCohortChecklist({
  facilitatorId,
  cohorts,
  linkedCohortIds,
}: {
  facilitatorId: string;
  cohorts: { id: string; name: string }[];
  linkedCohortIds: string[];
}) {
  const [linked, setLinked] = useState(new Set(linkedCohortIds));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(cohortId: string, checked: boolean) {
    setPendingId(cohortId);
    startTransition(async () => {
      const result = checked
        ? await linkCohortFacilitatorAction(facilitatorId, cohortId)
        : await unlinkCohortFacilitatorAction(facilitatorId, cohortId);
      if (!result || result.ok) {
        setLinked((prev) => {
          const next = new Set(prev);
          if (checked) next.add(cohortId);
          else next.delete(cohortId);
          return next;
        });
      }
      setPendingId(null);
    });
  }

  if (cohorts.length === 0) {
    return <p className="text-sm text-grey-600">No cohorts exist yet — create one under Admin → Cohorts first.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-grey-200 rounded-card border border-grey-200 bg-white">
      {cohorts.map((cohort) => (
        <div key={cohort.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm text-ink">{cohort.name}</span>
          <Switch
            checked={linked.has(cohort.id)}
            disabled={pendingId === cohort.id}
            onCheckedChange={(checked) => toggle(cohort.id, checked)}
          />
        </div>
      ))}
    </div>
  );
}
