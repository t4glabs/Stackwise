"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toggleFlagAction } from "@/lib/actions/flag-actions";
import type { FeatureFlagKey } from "@/lib/flags";

export function FlagToggle({
  flagKey,
  enabled,
}: {
  flagKey: FeatureFlagKey;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={enabled}
      disabled={pending}
      onCheckedChange={(checked) => {
        startTransition(async () => {
          await toggleFlagAction(flagKey, checked);
        });
      }}
    />
  );
}
