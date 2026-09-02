"use client";

import { useActionState } from "react";
import { syncNowAction } from "@/lib/actions/sync-actions";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function SyncNowButton() {
  const [state, formAction, pending] = useActionState(syncNowAction, undefined);

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Syncing…" : "Sync now"}
        </Button>
      </form>
      {state?.ok ? (
        <p className="text-xs text-success">
          Synced — {state.booksScanned} book{state.booksScanned === 1 ? "" : "s"} scanned
          {state.newlyDiscovered > 0 ? `, ${state.newlyDiscovered} new` : ""}.
        </p>
      ) : null}
      {state && !state.ok ? <p className="text-xs text-danger">{state.error}</p> : null}
    </div>
  );
}
