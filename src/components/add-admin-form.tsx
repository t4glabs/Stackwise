"use client";

import { useActionState } from "react";
import { createAdminAction } from "@/lib/actions/user-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AddAdminForm() {
  const [state, formAction, pending] = useActionState(createAdminAction, undefined);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-name">Full name</Label>
          <Input id="admin-name" name="name" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-email">Email</Label>
          <Input id="admin-email" name="email" type="email" autoComplete="off" required />
          <p className="text-xs text-grey-500">
            They&apos;ll get an email to set their own password — admins never get a shared
            temporary one.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-confirm">Your password</Label>
          <Input id="admin-confirm" name="confirmPassword" type="password" autoComplete="current-password" required />
          <p className="text-xs text-grey-500">Confirm it&apos;s really you adding a new admin.</p>
        </div>

        {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}

        <Button type="submit" disabled={pending} className="mt-2 self-start">
          {pending ? "Adding…" : "Add admin"}
        </Button>
      </form>

      {state?.ok ? (
        <Card className="border-success/30 bg-success-soft">
          <p className="text-sm font-medium text-ink">
            Admin added — a setup email was sent to {state.email}.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
