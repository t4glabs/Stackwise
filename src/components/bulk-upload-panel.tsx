import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function BulkUploadPanel({
  role,
  personLabel,
  emailOptional,
  cohortsFlagOn = false,
  allCohorts = [],
}: {
  role: "LEARNER" | "FACILITATOR";
  personLabel: string;
  emailOptional: boolean;
  // Learner uploads only — cohorts group learners, not facilitators.
  cohortsFlagOn?: boolean;
  allCohorts?: { id: string; name: string }[];
}) {
  const peoplePlural = personLabel.toLowerCase() + "s";
  const showCohortField = role === "LEARNER" && cohortsFlagOn;

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-1.5 text-sm text-grey-700">
        <li>1. Download the template below and open it in Excel.</li>
        <li>2. Delete the two example rows, add one row per {personLabel.toLowerCase()}.</li>
        <li>
          3. {emailOptional
            ? "Fill in Email, or leave it blank and fill in Username instead."
            : "Email is required for every row."}
        </li>
        <li>4. Save the file and upload it below — keep it as an .xlsx file.</li>
        <li>5. A file will download automatically with everyone&apos;s login details.</li>
      </ol>

      <a
        href={`/api/admin/bulk-template?role=${role}`}
        className="self-start text-sm font-medium text-accent hover:underline"
      >
        Download {peoplePlural} template (.xlsx)
      </a>

      <form
        method="post"
        action="/api/admin/bulk-upload"
        encType="multipart/form-data"
        className="flex flex-col gap-3 rounded-card border border-grey-200 bg-grey-50 p-4"
      >
        <input type="hidden" name="role" value={role} />

        {showCohortField ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="bulk-cohort" className="text-xs">
              Cohort for this batch (optional)
            </Label>
            <Input
              id="bulk-cohort"
              name="cohortName"
              placeholder="e.g. March 2026 Batch"
              list="bulk-existing-cohort-names"
            />
            <datalist id="bulk-existing-cohort-names">
              {allCohorts.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            <p className="text-xs text-grey-500">
              Adds everyone in this file to that cohort — matching an existing name reuses it.
              Leave blank to create accounts without one.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="flex-1 text-sm text-grey-700 file:mr-3 file:rounded-control file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
          <Button type="submit">Upload &amp; create accounts</Button>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="sendCredentialsEmail" className="size-4 rounded border-grey-400" />
          Email each person their login details (only those with an email address)
        </label>
      </form>
    </div>
  );
}
