"use client";

import { useActionState } from "react";
import Link from "next/link";
import { redeemPasswordResetAction } from "@/lib/actions/password-reset-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ResetPasswordForm({ token }: { token: string }) {
  const action = redeemPasswordResetAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, undefined);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-success">Password updated — you can log in now.</p>
        <Button variant="accent" asChild>
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} />
      </div>
      {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
      <Button variant="accent" type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
