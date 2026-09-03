"use client";

import { useActionState, useState } from "react";
import { saveOrgSettings } from "@/lib/actions/org-settings-actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

export function OrgSettingsForm({
  name,
  brandName,
  accentColor,
  heroHeading,
  heroDescription,
  wikiLinkLabel,
}: {
  name: string;
  brandName: string;
  accentColor: string;
  heroHeading: string;
  heroDescription: string;
  wikiLinkLabel: string;
}) {
  const [state, formAction, pending] = useActionState(saveOrgSettings, undefined);
  const [color, setColor] = useState(accentColor);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <Eyebrow>Identity</Eyebrow>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Organization name</Label>
          <Input id="name" name="name" defaultValue={name} required className="max-w-md" />
          <p className="text-xs text-grey-500">Shown on the course catalog and homepage.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brandName">LMS brand name</Label>
          <Input id="brandName" name="brandName" defaultValue={brandName} required className="max-w-md" />
          <p className="text-xs text-grey-500">Shown in the header and browser tab title.</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <Eyebrow>Color</Eyebrow>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="accentColor">Accent color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Pick accent color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-9 shrink-0 cursor-pointer rounded-control border border-grey-200 bg-white p-1"
            />
            <Input
              id="accentColor"
              name="accentColor"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="max-w-40 font-mono uppercase"
              required
            />
          </div>
          <p className="text-xs text-grey-500">Used for primary buttons and links across the site.</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <Eyebrow>Homepage</Eyebrow>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="heroHeading">Heading</Label>
          <Input id="heroHeading" name="heroHeading" defaultValue={heroHeading} required className="max-w-md" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="heroDescription">Description</Label>
          <Textarea
            id="heroDescription"
            name="heroDescription"
            defaultValue={heroDescription}
            rows={3}
            required
            className="max-w-md"
          />
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <Eyebrow>Footer</Eyebrow>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wikiLinkLabel">Wiki link text</Label>
          <Input id="wikiLinkLabel" name="wikiLinkLabel" defaultValue={wikiLinkLabel} required className="max-w-md" />
          <p className="text-xs text-grey-500">
            Shown in the footer, e.g. &quot;Content authored in {wikiLinkLabel || "the wiki"}&quot;.
          </p>
        </div>
      </div>

      {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-success">Saved.</p> : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
