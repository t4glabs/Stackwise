"use client";

import { useState } from "react";
import { AddCohortForm } from "@/components/cohort-manager";
import { Card } from "@/components/ui/card";

// The org-wide cohorts page's own "create a cohort" entry point — reuses the same
// create-or-reuse form every course's "Manage cohorts" panel uses (see
// cohort-manager.tsx), just without a course context: revalidating "/admin/cohorts"
// itself is enough here, this page is already the canonical place cohorts show up.
export function AddCohortToggle({ allCohorts }: {
  allCohorts: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm font-medium text-accent hover:underline"
      >
        + Add a cohort
      </button>
    );
  }

  return (
    <Card className="max-w-md">
      <AddCohortForm
        coursePath="/admin/cohorts"
        allCohorts={allCohorts}
        onDone={() => setOpen(false)}
      />
    </Card>
  );
}
