"use client";

import { useActionState, useTransition } from "react";
import { addCustomLink, deleteCustomLink } from "@/lib/actions/custom-link-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { X, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { LinkPlacement } from "@/generated/prisma/client";

type Link = { id: string; label: string; url: string; openInNewTab: boolean };

export function CustomLinksManager({
  placement,
  links,
}: {
  placement: LinkPlacement;
  links: Link[];
}) {
  const action = addCustomLink.bind(null, placement);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [openInNewTab, setOpenInNewTab] = useState(true);
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {links.length > 0 ? (
        <ul className="flex flex-col divide-y divide-grey-200 rounded-control border border-grey-200">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium text-ink">{link.label}</span>
                <span className="truncate text-grey-500">{link.url}</span>
                {link.openInNewTab ? <ExternalLink className="size-3 shrink-0 text-grey-400" /> : null}
              </span>
              <button
                type="button"
                aria-label={`Remove ${link.label}`}
                onClick={() => startTransition(() => deleteCustomLink(link.id))}
                className="shrink-0 text-grey-400 hover:text-danger"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${placement}-label`} className="text-xs">
            Label
          </Label>
          <Input id={`${placement}-label`} name="label" placeholder="e.g. Donate" className="w-32" required />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${placement}-url`} className="text-xs">
            Link
          </Label>
          <Input id={`${placement}-url`} name="url" placeholder="https://…" type="url" className="w-56" required />
        </div>
        <label className="flex items-center gap-2 pb-2 text-xs text-grey-700">
          <input type="hidden" name="openInNewTab" value={openInNewTab ? "on" : "off"} />
          <Switch checked={openInNewTab} onCheckedChange={setOpenInNewTab} />
          New tab
        </label>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add link"}
        </Button>
      </form>
      {state && !state.ok ? <p className="text-xs text-danger">{state.error}</p> : null}
    </div>
  );
}
