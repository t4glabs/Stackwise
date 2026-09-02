"use client";

import { useActionState, useState, useTransition } from "react";
import { uploadBrandImage, removeBrandImage } from "@/lib/actions/branding-upload-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function BrandImageUpload({
  kind,
  label,
  hint,
  currentUrl,
  previewClassName,
}: {
  kind: "logo" | "favicon";
  label: string;
  hint: string;
  currentUrl: string | null;
  previewClassName: string;
}) {
  const action = uploadBrandImage.bind(null, kind);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [removed, setRemoved] = useState(false);
  const [removing, startRemoving] = useTransition();

  const shownUrl = state?.ok ? state.url : removed ? null : currentUrl;

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-control border border-grey-200 bg-grey-50 ${previewClassName}`}
        >
          {shownUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded, unknown-dimension images; a fixed-box <img> is simpler than next/image here
            <img src={shownUrl} alt="" className="size-full object-contain" />
          ) : (
            <span className="text-[11px] text-grey-500">None set</span>
          )}
        </div>
        <form action={formAction} className="flex min-w-0 flex-wrap items-center gap-2">
          <input
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
            required
            className="min-w-0 max-w-48 text-xs text-grey-700 file:mr-2 file:rounded-control file:border-0 file:bg-ink file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white"
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "Uploading…" : "Upload"}
          </Button>
        </form>
        {shownUrl ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={removing}
            onClick={() => {
              setRemoved(true);
              startRemoving(() => removeBrandImage(kind));
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-grey-500">{hint}</p>
      {state && !state.ok ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="text-xs text-success">Uploaded.</p> : null}
    </div>
  );
}
