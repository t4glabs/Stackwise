"use client";

import { useActionState } from "react";
import { createLearnerAction } from "@/lib/actions/user-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function CreateLearnerForm() {
  const [state, formAction, pending] = useActionState(createLearnerAction, undefined);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Learner&apos;s full name</Label>
          <Input id="name" name="name" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" name="username" placeholder="e.g. first name + initial" required />
        </div>

        {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}

        <Button type="submit" disabled={pending} className="mt-2">
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>

      {state?.ok ? (
        <Card className="border-success/30 bg-success-soft">
          <p className="text-sm font-medium text-ink">Account created — share these with the learner:</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-sm">
            <dt className="text-grey-700">Username</dt>
            <dd className="text-ink">{state.username}</dd>
            <dt className="text-grey-700">Password</dt>
            <dd className="text-ink">{state.password}</dd>
          </dl>
          <p className="mt-3 text-xs text-grey-600">
            This password is only shown once — write it down now.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
