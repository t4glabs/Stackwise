"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "@/lib/actions/resend-verification-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ResendVerificationForm() {
  const [message, formAction, pending] = useActionState(resendVerificationAction, undefined);

  if (message) {
    return <p className="text-sm text-success">{message}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button variant="accent" type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Resend link"}
      </Button>
    </form>
  );
}
