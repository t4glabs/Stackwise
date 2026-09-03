"use client";

import { useActionState } from "react";
import Link from "next/link";
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs font-medium text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      {error ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-danger">{error}</p>
          {error.includes("verify") ? (
            <Link href="/resend-verification" className="text-xs font-medium text-accent hover:underline">
              Resend the confirmation email
            </Link>
          ) : null}
        </div>
      ) : null}

      <Button variant="accent" type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Signing in…" : "Log in"}
      </Button>
    </form>
  );
}
