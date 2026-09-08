"use client";

import { useActionState, useRef } from "react";
import { uploadSubmissionAction } from "@/lib/actions/submission-actions";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload } from "lucide-react";

export type SubmissionRow = {
  id: string;
  fileName: string;
  note: string | null;
  createdAt: string;
};

// Sits on the learner's own course page — evidence for one enrollment, never
// required for a facilitator to approve (see manual_completion_approval's flag
// description), just a way to attach something if there's anything digital to share.
export function SubmissionPanel({
  enrollmentId,
  coursePath,
  submissions,
  awaitingReview,
  revisionNote,
}: {
  enrollmentId: string;
  coursePath: string;
  submissions: SubmissionRow[];
  awaitingReview: boolean;
  revisionNote: string | null;
}) {
  const action = uploadSubmissionAction.bind(null, enrollmentId, coursePath);
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-4 rounded-card border border-stone-200 bg-white p-6">
      {awaitingReview ? (
        <div className="rounded-control bg-accent-soft px-4 py-2.5 text-[14px] font-medium text-accent">
          100% done — waiting on your facilitator to confirm this course.
        </div>
      ) : null}

      {revisionNote ? (
        <div className="rounded-control border border-warning/30 bg-warning-soft px-4 py-3 text-[14px] text-warning">
          <span className="font-medium">Your facilitator asked for another look: </span>
          {revisionNote}
        </div>
      ) : null}

      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[14px] font-medium text-ink">
          <Paperclip className="size-4 text-stone-500" /> Your work for this course
        </p>
        <p className="text-[13px] text-stone-600">
          Optional — attach a local test, homework, or anything else you did offline. Your
          facilitator can see it, but doesn&apos;t need it to confirm you&apos;re done.
        </p>
      </div>

      {submissions.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {submissions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 text-[13.5px]">
              <a
                href={`/api/submissions/${s.id}/download`}
                className="font-medium text-accent hover:underline"
              >
                {s.fileName}
              </a>
              <span className="text-stone-500">
                {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              {s.note ? <span className="text-stone-500">&middot; {s.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="flex flex-col gap-2.5 border-t border-stone-200 pt-4"
      >
        <input
          type="file"
          name="file"
          required
          className="text-[13.5px] text-stone-600 file:mr-3 file:rounded-control file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-ink"
        />
        <input
          type="text"
          name="note"
          placeholder="A short note (optional)"
          className="w-full rounded-control border border-stone-200 px-3 py-1.5 text-[13.5px] text-ink placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        {state && !state.ok ? <p className="text-[13px] text-danger">{state.error}</p> : null}
        <Button type="submit" variant="outline" size="sm" disabled={pending} className="self-start">
          <Upload className="size-4" /> {pending ? "Uploading…" : "Upload"}
        </Button>
      </form>
    </div>
  );
}
