"use client";

import { useActionState, useState } from "react";
import { saveCourseConfig } from "@/lib/actions/course-config-actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const TYPE_OPTIONS = [
  { value: "SELF_PACED", label: "Self-paced — learner works through it on their own" },
  { value: "FACILITATED", label: "Facilitated — runs with a facilitator" },
  { value: "EXTERNAL_LINK", label: "External link — hosted elsewhere (e.g. Unithena)" },
];

export function CourseConfigForm({
  courseId,
  published,
  type,
  programName,
  durationLabel,
  externalUrl,
  downloadableWorkbook,
  assignedFacilitatorIds,
  allPrograms,
  allFacilitators,
}: {
  courseId: string;
  published: boolean;
  type: string;
  programName: string;
  durationLabel: string;
  externalUrl: string;
  downloadableWorkbook: boolean;
  assignedFacilitatorIds: string[];
  allPrograms: string[];
  allFacilitators: { id: string; name: string }[];
}) {
  const [selectedType, setSelectedType] = useState(type);
  const [isPublished, setIsPublished] = useState(published);
  const [isDownloadable, setIsDownloadable] = useState(downloadableWorkbook);
  const action = saveCourseConfig.bind(null, courseId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex items-center justify-between rounded-card border border-grey-200 bg-grey-50 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-ink">Show in course catalog</p>
          <p className="text-sm text-grey-600">Off means learners can&apos;t see or enroll in it.</p>
        </div>
        {/* Radix's Switch is a <button>, not a real checkbox — it doesn't reliably
            bubble into native FormData, so the hidden input below is what the server
            action actually reads. */}
        <input type="hidden" name="published" value={isPublished ? "on" : "off"} />
        <Switch checked={isPublished} onCheckedChange={setIsPublished} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type">How is it delivered?</Label>
        <select
          id="type"
          name="type"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="h-9 rounded-control border border-grey-200 bg-white px-3 text-sm text-ink"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {selectedType === "EXTERNAL_LINK" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="externalUrl">Where does it open?</Label>
          <Input
            id="externalUrl"
            name="externalUrl"
            type="url"
            placeholder="https://…"
            defaultValue={externalUrl}
            required
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="program">Program</Label>
        <Input
          id="program"
          name="program"
          list="program-options"
          placeholder="e.g. Transition Program"
          defaultValue={programName}
        />
        <datalist id="program-options">
          {allPrograms.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="duration">Duration</Label>
        <Input id="duration" name="duration" placeholder="e.g. 3 hours" defaultValue={durationLabel} />
      </div>

      {selectedType !== "EXTERNAL_LINK" ? (
        <div className="flex items-center justify-between rounded-card border border-grey-200 bg-grey-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-ink">Downloadable workbook (.docx)</p>
            <p className="text-sm text-grey-600">
              Lets learners download this course, or a single chapter, as a Word document
              to fill in and share back.
            </p>
          </div>
          <input type="hidden" name="downloadableWorkbook" value={isDownloadable ? "on" : "off"} />
          <Switch checked={isDownloadable} onCheckedChange={setIsDownloadable} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label>Facilitators</Label>
        {allFacilitators.length === 0 ? (
          <p className="text-sm text-grey-600">
            No facilitator accounts yet — add one under People first.
          </p>
        ) : (
          <div className="flex flex-col gap-2 rounded-card border border-grey-200 p-4">
            {allFacilitators.map((f) => (
              <label key={f.id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name="facilitatorIds"
                  value={f.id}
                  defaultChecked={assignedFacilitatorIds.includes(f.id)}
                  className="size-4 rounded border-grey-400"
                />
                {f.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.ok && state.tagSyncFailed ? (
        <p className="text-sm text-warning">
          Saved here, but couldn&apos;t write this back to BookStack — check the connection.
        </p>
      ) : null}
      {state?.ok && !state.tagSyncFailed ? (
        <p className="text-sm text-success">Saved.</p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
