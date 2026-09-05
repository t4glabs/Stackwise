"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCohortAction } from "@/lib/actions/cohort-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Same type-to-confirm pattern as DeleteUserButton — a cohort can carry dozens of
// members, courses, and facilitator links, and unlike deactivating a person there's
// no "undo" here (deleteCohortAction only un-tags Enrollment rows, it never touches
// Progress/Certificate, but the cohort grouping itself is gone for good).
export function DeleteCohortButton({ cohortId, name }: { cohortId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)} className="text-danger hover:text-danger">
        Delete cohort
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-danger/30 bg-danger-soft p-3.5 text-sm">
      <p className="text-danger">
        This deletes {name} everywhere — every course it follows, every member link, every
        facilitator scoped to it. Nobody gets un-enrolled and no progress or certificate is
        touched; they just stop being grouped under this cohort. There&apos;s no undo.
      </p>
      <label className="flex flex-col gap-1 text-xs text-grey-700">
        Type &quot;{name}&quot; to confirm
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
      </label>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={typed !== name || pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteCohortAction(cohortId);
              if (result && !result.ok) setError(result.error);
              else router.push("/admin/cohorts");
            })
          }
          className="border-danger text-danger hover:bg-white"
        >
          {pending ? "Deleting…" : "Yes, delete permanently"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setTyped("");
            setError(null);
          }}
          className="text-xs font-medium text-grey-600 hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
