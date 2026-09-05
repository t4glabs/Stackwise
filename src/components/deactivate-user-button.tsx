"use client";

import { useActionState } from "react";
import { deactivateUserAction, reactivateUserAction } from "@/lib/actions/user-actions";
import { Button } from "@/components/ui/button";

// The safe, reversible removal control — refuses login without touching any history.
// Separate from ResetPasswordButton (which a facilitator can also use on their own
// learners) since pulling someone's access entirely is an admin-only call.
export function DeactivateUserButton({ userId, disabled }: { userId: string; disabled: boolean }) {
  const action = (disabled ? reactivateUserAction : deactivateUserAction).bind(null, userId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction}>
      <Button variant="ghost" size="sm" type="submit" disabled={pending}>
        {pending ? (disabled ? "Reactivating…" : "Deactivating…") : disabled ? "Reactivate" : "Deactivate"}
      </Button>
      {state && !state.ok ? <p className="mt-1 text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
