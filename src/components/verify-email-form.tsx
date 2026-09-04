"use client";

import { useActionState } from "react";
import Link from "next/link";
import { confirmEmailAction } from "@/lib/actions/verify-email-actions";
import { Button } from "@/components/ui/button";

export function VerifyEmailForm({ token }: { token: string }) {
  const action = confirmEmailAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, undefined);

  if (state?.ok) {
    return (
      <>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Email confirmed</h1>
          <p className="text-[15px] text-stone-600">Your account is active — you can log in now.</p>
        </div>
        <Button variant="accent" asChild className="self-center">
          <Link href="/login">Log in</Link>
        </Button>
      </>
    );
  }

  if (state && !state.ok) {
    return (
      <>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Link expired or invalid</h1>
          <p className="text-[15px] text-stone-600">{state.error}</p>
        </div>
        <Link href="/resend-verification" className="text-sm font-medium text-accent hover:underline">
          Send a new link
        </Link>
      </>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-center gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Confirm your email</h1>
        <p className="text-[15px] text-stone-600">Click below to activate your account.</p>
      </div>
      <Button variant="accent" type="submit" disabled={pending} className="self-center">
        {pending ? "Confirming…" : "Confirm email"}
      </Button>
    </form>
  );
}
