import * as XLSX from "xlsx";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { generateTempPassword } from "@/lib/temp-password";
import { generateUniqueUsername } from "@/lib/username";
import type { Role } from "@/generated/prisma/client";

const SHEET_NAME = "People" as const;
const emailSchema = z.email();

// ---- Template (downloaded by the admin, filled in Excel/LibreOffice/Sheets) ----

export function buildTemplateWorkbook(role: Role, emailOptional: boolean): XLSX.WorkBook {
  const person = role === "FACILITATOR" ? "facilitator" : "learner";
  const wb = XLSX.utils.book_new();

  const instructions = emailOptional
    ? [
        ["How to use this file"],
        [`1. Don't change the column headers in the "${SHEET_NAME}" tab.`],
        ["2. Delete the two example rows and add one row per person."],
        ["3. Fill in Email, OR leave it blank and fill in Username instead — not both empty."],
        ["4. Save the file (keep it as .xlsx) and upload it back on the People page."],
        ["5. A new file will download automatically with everyone's login details."],
      ]
    : [
        ["How to use this file"],
        [`1. Don't change the column headers in the "${SHEET_NAME}" tab.`],
        ["2. Delete the two example rows and add one row per person."],
        ["3. Email is required for every row."],
        ["4. Save the file (keep it as .xlsx) and upload it back on the People page."],
        ["5. A new file will download automatically with everyone's login details."],
      ];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
  instructionsSheet["!cols"] = [{ wch: 70 }];
  XLSX.utils.book_append_sheet(wb, instructionsSheet, "Instructions");

  const header = emailOptional ? ["Full Name", "Email", "Username"] : ["Full Name", "Email"];
  const exampleRows = emailOptional
    ? [
        ["Asha Kumar", "asha@example.org", ""],
        ["Ravi (no email)", "", "ravi-k"],
      ]
    : [
        ["Asha Kumar", `asha@example.org`],
        ["Ravi Shah", `ravi@example.org`],
      ];
  const dataSheet = XLSX.utils.aoa_to_sheet([header, ...exampleRows]);
  dataSheet["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, dataSheet, SHEET_NAME);

  void person;
  return wb;
}

// ---- Upload parsing + validation ----

export type ImportRowResult = {
  name: string;
  email: string;
  username: string;
  password: string;
  status: "Created" | string; // any other string is a skip reason
};

export type ImportSummary = {
  results: ImportRowResult[];
  createdCount: number;
  skippedCount: number;
};

type RawRow = { name: string; email: string; username: string };

function readRows(buffer: ArrayBuffer): RawRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames.includes(SHEET_NAME) ? SHEET_NAME : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map((row) => ({
    name: String(row["Full Name"] ?? row["Name"] ?? "").trim(),
    email: String(row["Email"] ?? "").trim().toLowerCase(),
    username: String(row["Username"] ?? "").trim().toLowerCase(),
  }));
}

export async function importUsersFromWorkbook(
  buffer: ArrayBuffer,
  role: Role,
  organizationId: string,
  createdById: string,
  emailOptional: boolean
): Promise<ImportSummary> {
  const rows = readRows(buffer).filter((r) => r.name || r.email || r.username);

  const results: ImportRowResult[] = [];
  const seenEmails = new Set<string>();
  const seenUsernames = new Set<string>();
  const reservedUsernames = new Set<string>();

  for (const row of rows) {
    if (!row.name) {
      results.push({ ...row, password: "", status: "Skipped: missing name" });
      continue;
    }

    if (!row.email && !row.username) {
      if (!emailOptional) {
        results.push({ ...row, password: "", status: "Skipped: email is required" });
        continue;
      }
      results.push({ ...row, password: "", status: "Skipped: needs an email or a username" });
      continue;
    }

    if (row.email) {
      const parsed = emailSchema.safeParse(row.email);
      if (!parsed.success) {
        results.push({ ...row, password: "", status: "Skipped: invalid email" });
        continue;
      }
      if (seenEmails.has(row.email)) {
        results.push({ ...row, password: "", status: "Skipped: duplicate email in this file" });
        continue;
      }
      const existing = await prisma.user.findUnique({ where: { email: row.email } });
      if (existing) {
        results.push({ ...row, password: "", status: "Skipped: email already in use" });
        continue;
      }
    } else {
      if (!/^[a-z0-9._-]{3,}$/.test(row.username)) {
        results.push({ ...row, password: "", status: "Skipped: invalid username (min 3 chars, letters/numbers/._-)" });
        continue;
      }
      if (seenUsernames.has(row.username)) {
        results.push({ ...row, password: "", status: "Skipped: duplicate username in this file" });
        continue;
      }
      const existing = await prisma.user.findUnique({ where: { username: row.username } });
      if (existing) {
        results.push({ ...row, password: "", status: "Skipped: username already taken" });
        continue;
      }
    }

    const email = row.email || null;
    const username = email ? await generateUniqueUsername(email, reservedUsernames) : row.username;
    if (email) seenEmails.add(email);
    else seenUsernames.add(username);

    const password = generateTempPassword();
    await prisma.user.create({
      data: {
        organizationId,
        role,
        name: row.name,
        email,
        username,
        passwordHash: await hashPassword(password),
        createdById,
      },
    });

    results.push({ name: row.name, email: email ?? "", username, password, status: "Created" });
  }

  return {
    results,
    createdCount: results.filter((r) => r.status === "Created").length,
    skippedCount: results.filter((r) => r.status !== "Created").length,
  };
}

// ---- Results workbook (downloaded immediately after upload) ----

export function buildResultsWorkbook(summary: ImportSummary): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const header = ["Full Name", "Email", "Username", "Password", "Status"];
  const rows = summary.results.map((r) => [r.name, r.email, r.username, r.password, r.status]);
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, sheet, "Results");
  return wb;
}

export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
