import * as XLSX from "xlsx";

export type CohortRosterRow = {
  name: string;
  identifier: string;
  overallPercent: number;
  hasCertificate: boolean;
  // One entry per course this cohort follows, same order for every row — a per-course
  // breakdown that the on-screen member list deliberately doesn't show (it'd be
  // unreadable at a glance for a 6-course cohort), but is exactly what's useful once
  // it's in a spreadsheet someone's already scrolling through.
  perCourse: number[];
};

export function buildCohortRosterWorkbook(
  cohortName: string,
  courseTitles: string[],
  rows: CohortRosterRow[]
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const header = ["Name", "Login", "Overall progress", "Earned a certificate", ...courseTitles];
  const dataRows = rows.map((r) => [
    r.name,
    r.identifier,
    `${Math.round(r.overallPercent)}%`,
    r.hasCertificate ? "Yes" : "No",
    ...r.perCourse.map((p) => `${Math.round(p)}%`),
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  sheet["!cols"] = [
    { wch: 22 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    ...courseTitles.map(() => ({ wch: 20 })),
  ];
  // Sheet names can't contain : \ / ? * [ ] and cap out at 31 characters — a cohort
  // name is free text an admin typed in, so it isn't guaranteed to already be safe.
  const safeSheetName = cohortName.replace(/[:\\/?*[\]]/g, " ").slice(0, 31).trim() || "Roster";
  XLSX.utils.book_append_sheet(wb, sheet, safeSheetName);
  return wb;
}
