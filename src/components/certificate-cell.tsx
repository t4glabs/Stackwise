"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { issueCertificateAction, revokeCertificateAction } from "@/lib/actions/certificate-actions";
import { Button } from "@/components/ui/button";

export function CertificateCell({
  learnerId,
  courseId,
  coursePath,
  completed,
  certificateId,
  canRevoke,
}: {
  learnerId: string;
  courseId: string;
  coursePath: string;
  completed: boolean;
  certificateId: string | null;
  canRevoke: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!completed) {
    return <span className="text-grey-400">—</span>;
  }

  if (certificateId) {
    return (
      <div className="flex items-center gap-3">
        <Link href={`/certificates/${certificateId}`} target="_blank" className="font-medium text-accent hover:underline">
          View
        </Link>
        {canRevoke ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await revokeCertificateAction(certificateId, coursePath);
                if (result && !result.ok) setError(result.error);
              })
            }
            className="text-grey-500 hover:text-danger disabled:opacity-50"
          >
            Revoke
          </button>
        ) : null}
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await issueCertificateAction(learnerId, courseId, coursePath);
            if (result && !result.ok) setError(result.error);
          })
        }
      >
        {pending ? "Issuing…" : "Issue certificate"}
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
