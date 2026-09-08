"use client";

import { useState, useTransition } from "react";
import { approveCompletionAction, requestRevisionAction } from "@/lib/actions/submission-actions";
import { Button } from "@/components/ui/button";

export type ReviewSubmission = { id: string; fileName: string; createdAt: string; note: string | null };

// The facilitator/admin-facing half of manual_completion_approval — mirrors
// CertificateCell's shape (a compact, self-contained table cell) rather than a
// separate page, since this is one more decision about one learner/course pair,
// same as issuing a certificate already is.
export function CompletionReviewCell({
  enrollmentId,
  coursePath,
  awaitingReview,
  revisionNote,
  submissions,
}: {
  enrollmentId: string;
  coursePath: string;
  awaitingReview: boolean;
  revisionNote: string | null;
  submissions: ReviewSubmission[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sendingBack, setSendingBack] = useState(false);
  const [note, setNote] = useState("");

  if (!awaitingReview && submissions.length === 0 && !revisionNote) {
    return <span className="text-grey-400">—</span>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {submissions.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {submissions.map((s) => (
            <li key={s.id} className="text-xs">
              <a href={`/api/submissions/${s.id}/download`} className="font-medium text-accent hover:underline">
                {s.fileName}
              </a>
              <span className="ml-1 text-grey-500">
                {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {revisionNote ? (
        <p className="text-xs text-warning">
          <span className="font-medium">Sent back: </span>
          {revisionNote}
        </p>
      ) : null}

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {awaitingReview ? (
        sendingBack ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What needs another look?"
              rows={2}
              className="w-48 rounded-control border border-grey-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || !note.trim()}
                onClick={() =>
                  startTransition(async () => {
                    const formData = new FormData();
                    formData.set("note", note);
                    const result = await requestRevisionAction(enrollmentId, coursePath, undefined, formData);
                    if (result && !result.ok) setError(result.error);
                    else {
                      setSendingBack(false);
                      setNote("");
                    }
                  })
                }
              >
                {pending ? "Sending…" : "Send back"}
              </Button>
              <button
                type="button"
                onClick={() => setSendingBack(false)}
                className="text-xs font-medium text-grey-600 hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await approveCompletionAction(enrollmentId, coursePath);
                  if (result && !result.ok) setError(result.error);
                })
              }
            >
              {pending ? "Approving…" : "Approve"}
            </Button>
            <button
              type="button"
              onClick={() => setSendingBack(true)}
              className="text-xs font-medium text-grey-600 hover:text-ink"
            >
              Send back
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
