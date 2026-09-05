"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { permanentlyDeleteUserAction } from "@/lib/actions/user-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Deliberately harder to reach than deactivation — a plain click here can't erase
// anyone by accident. Only ever rendered for an already-deactivated learner or
// facilitator (see the call sites); the action itself re-enforces both of those.
export function DeleteUserButton({
  userId,
  name,
  redirectTo,
}: {
  userId: string;
  name: string;
  redirectTo: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
        className="text-danger hover:text-danger"
      >
        Delete permanently
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-danger/30 bg-danger-soft p-3.5 text-sm">
      <p className="text-danger">
        This erases {name}&apos;s account and every enrollment, progress record, cohort
        membership, and certificate tied to it — permanently, with no way to undo it.
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
              const result = await permanentlyDeleteUserAction(userId, undefined);
              if (result && !result.ok) setError(result.error);
              else router.push(redirectTo);
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
