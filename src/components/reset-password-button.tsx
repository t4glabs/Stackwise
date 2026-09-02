"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/lib/actions/user-actions";
import { Button } from "@/components/ui/button";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const action = resetPasswordAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, undefined);

  if (state?.ok) {
    return (
      <span className="font-mono text-xs text-ink">
        new password: <span className="font-semibold">{state.password}</span>
      </span>
    );
  }

  return (
    <form action={formAction}>
      <Button variant="ghost" size="sm" type="submit" disabled={pending}>
        {pending ? "Resetting…" : "Reset password"}
      </Button>
      {state && !state.ok ? <p className="mt-1 text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
