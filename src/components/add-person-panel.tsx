"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CreateUserForm } from "@/components/create-user-form";
import { BulkUploadPanel } from "@/components/bulk-upload-panel";
import type { CreateUserState } from "@/lib/actions/user-actions";

export function AddPersonPanel({
  role,
  action,
  personLabel,
  emailOptional,
}: {
  role: "LEARNER" | "FACILITATOR";
  action: (state: CreateUserState, formData: FormData) => Promise<CreateUserState>;
  personLabel: string;
  emailOptional: boolean;
}) {
  const [mode, setMode] = useState<"single" | "bulk">("single");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 rounded-control bg-grey-100 p-1 text-sm font-medium">
        {(["single", "bulk"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 rounded-control px-3 py-1.5 transition-colors",
              mode === m ? "bg-white text-ink shadow-sm" : "text-grey-600 hover:text-ink"
            )}
          >
            {m === "single" ? "Add one" : "Bulk add (Excel)"}
          </button>
        ))}
      </div>

      {mode === "single" ? (
        <CreateUserForm action={action} personLabel={personLabel} emailOptional={emailOptional} />
      ) : (
        <BulkUploadPanel role={role} personLabel={personLabel} emailOptional={emailOptional} />
      )}
    </div>
  );
}
