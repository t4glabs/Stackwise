import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFlags } from "@/lib/flags";
import { canManageRole } from "@/lib/people-permissions";
import { importUsersFromWorkbook, buildResultsWorkbook, workbookToBuffer } from "@/lib/bulk-import";
import type { Role } from "@/generated/prisma/client";

// Plain <form method="post" encType="multipart/form-data"> submits here directly (no
// client JS) — the browser downloads the response as a file because of the
// Content-Disposition header below, without navigating away from /admin/people.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const formData = await request.formData();
  const role = formData.get("role") as Role | null;
  const file = formData.get("file");

  const backTo = new URL("/admin/people", request.url);
  backTo.searchParams.set("tab", role === "FACILITATOR" ? "facilitators" : "learners");

  if (role !== "LEARNER" && role !== "FACILITATOR") {
    backTo.searchParams.set("bulkError", "You don't have permission to do that.");
    return NextResponse.redirect(backTo);
  }
  if (!canManageRole(session.user.role, role)) {
    backTo.searchParams.set("bulkError", "You don't have permission to do that.");
    return NextResponse.redirect(backTo);
  }
  if (!(file instanceof File) || file.size === 0) {
    backTo.searchParams.set("bulkError", "Choose a filled-in template file first.");
    return NextResponse.redirect(backTo);
  }

  const flags = await getFlags(session.user.organizationId);
  const emailOptional = role === "LEARNER" ? flags.learner_email_optional : flags.facilitator_email_optional;
  const sendCredentialsEmail = formData.get("sendCredentialsEmail") === "on";

  // Learner-only, and only when Cohorts is on — same create-or-reuse-by-name upsert
  // as the single-cohort form (see createCohortAction), just resolved here instead
  // of as a separate step, so the whole batch lands as standing cohort members.
  let cohortId: string | null = null;
  const cohortName = String(formData.get("cohortName") ?? "").trim();
  if (role === "LEARNER" && flags.cohorts && cohortName) {
    const cohort = await prisma.cohort.upsert({
      where: { organizationId_name: { organizationId: session.user.organizationId, name: cohortName } },
      create: { organizationId: session.user.organizationId, name: cohortName },
      update: {},
    });
    cohortId = cohort.id;
  }

  let summary;
  try {
    const buffer = await file.arrayBuffer();
    summary = await importUsersFromWorkbook(
      buffer,
      role,
      session.user.organizationId,
      session.user.id,
      emailOptional,
      sendCredentialsEmail,
      cohortId
    );
  } catch {
    backTo.searchParams.set(
      "bulkError",
      "Couldn't read that file — make sure it's the .xlsx template, unedited column headers."
    );
    return NextResponse.redirect(backTo);
  }

  if (summary.results.length === 0) {
    backTo.searchParams.set("bulkError", "That file didn't have any rows to add.");
    return NextResponse.redirect(backTo);
  }

  const buffer = workbookToBuffer(buildResultsWorkbook(summary));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${role === "LEARNER" ? "learners" : "facilitators"}-results.xlsx"`,
    },
  });
}
