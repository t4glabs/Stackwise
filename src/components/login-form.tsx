"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="identifier">Email or username</Label>
        <Input id="identifier" name="identifier" autoComplete="username" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button variant="accent" type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Signing in…" : "Log in"}
      </Button>
    </form>
  );
}
