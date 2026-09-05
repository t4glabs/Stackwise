"use client";

import { useActionState, useState } from "react";
import { saveCourseConfig } from "@/lib/actions/course-config-actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

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
  certificateEnabled,
  certificatesFlagOn,
  externalLinkCoursesFlagOn,
  facilitatorAssignmentFlagOn,
  cohortRestrictedFacilitatorsOnly,
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
  certificateEnabled: boolean;
  certificatesFlagOn: boolean;
  externalLinkCoursesFlagOn: boolean;
  facilitatorAssignmentFlagOn: boolean;
  // Cohorts sub-setting: when on, facilitator access comes entirely from cohort
  // links (set on the facilitator's own page), so this course-level checklist stops
  // being a real way to grant access — hide it rather than leave a control that
  // looks like it does something it no longer does.
  cohortRestrictedFacilitatorsOnly: boolean;
  assignedFacilitatorIds: string[];
  allPrograms: string[];
  allFacilitators: { id: string; name: string }[];
}) {
  // Keep the current type selectable even if its flag is now off — an admin needs to
  // be able to see/change away from it, not get stuck with a value the dropdown no
  // longer offers.
  const typeOptions = TYPE_OPTIONS.filter(
    (opt) => opt.value !== "EXTERNAL_LINK" || externalLinkCoursesFlagOn || type === "EXTERNAL_LINK"
  );
  const [selectedType, setSelectedType] = useState(type);
  const [isPublished, setIsPublished] = useState(published);
  const [isDownloadable, setIsDownloadable] = useState(downloadableWorkbook);
  const [isCertified, setIsCertified] = useState(certificateEnabled);
  const action = saveCourseConfig.bind(null, courseId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {/* Two columns on wide screens so the form doesn't force a long single-file
          scroll when there's plenty of room to lay related fields side by side —
          "delivery" settings on the left, "features & people" on the right. */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Eyebrow>Delivery</Eyebrow>

          <div className="flex items-center justify-between rounded-card border border-grey-200 bg-grey-50 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-ink">Show in course catalog</p>
              <p className="text-sm text-grey-600">Off means learners can&apos;t see or enroll in it.</p>
            </div>
            {/* Radix's Switch is a <button>, not a real checkbox — it doesn't reliably
                bubble into native FormData, so the hidden input below is what the
                server action actually reads. */}
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
              {typeOptions.map((opt) => (
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
        </div>

        <div className="flex flex-col gap-5">
          <Eyebrow>Features &amp; people</Eyebrow>

          {selectedType !== "EXTERNAL_LINK" ? (
            <div className="flex items-center justify-between rounded-card border border-grey-200 bg-grey-50 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-ink">Downloadable workbook (.docx)</p>
                <p className="text-sm text-grey-600">
                  Lets learners download this course, or a single chapter, as a Word
                  document to fill in and share back.
                </p>
              </div>
              <input type="hidden" name="downloadableWorkbook" value={isDownloadable ? "on" : "off"} />
              <Switch checked={isDownloadable} onCheckedChange={setIsDownloadable} />
            </div>
          ) : null}

          {certificatesFlagOn ? (
            <div className="flex items-center justify-between rounded-card border border-grey-200 bg-grey-50 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-ink">Award a certificate</p>
                <p className="text-sm text-grey-600">
                  Learners get a certificate automatically when they complete this
                  course. Certificates are turned on org-wide under Feature flags —
                  this switches them on for this course specifically.
                </p>
              </div>
              <input type="hidden" name="certificateEnabled" value={isCertified ? "on" : "off"} />
              <Switch checked={isCertified} onCheckedChange={setIsCertified} />
            </div>
          ) : null}

          {facilitatorAssignmentFlagOn && !cohortRestrictedFacilitatorsOnly ? (
            <div className="flex flex-col gap-2">
              <Label>Facilitators</Label>
              <p className="text-xs text-grey-500">
                Checking someone here gives them full access to every learner enrolled in this one
                course — nothing outside it. Also set-able the other way, from a facilitator&apos;s
                own page under People, if this org uses cohorts instead.
              </p>
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
          ) : (
            // Either facilitator assignment is org-wide off (any facilitator manages
            // any course), or cohort-only facilitators is on (access comes from
            // cohort links instead) — either way, keep whatever assignments already
            // exist as-is rather than letting a save on this form silently wipe them.
            assignedFacilitatorIds.map((id) => (
              <input key={id} type="hidden" name="facilitatorIds" value={id} />
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-grey-200 pt-6">
        {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
        {state?.ok && state.tagSyncFailed ? (
          <p className="text-sm text-warning">
            Saved here, but couldn&apos;t write this back to BookStack — check the connection.
          </p>
        ) : null}
        {state?.ok && !state.tagSyncFailed ? <p className="text-sm text-success">Saved.</p> : null}

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
