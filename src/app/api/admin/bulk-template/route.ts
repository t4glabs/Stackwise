import { auth } from "@/auth";
import { getFlags } from "@/lib/flags";
import { canManageRole } from "@/lib/people-permissions";
import { buildTemplateWorkbook, workbookToBuffer } from "@/lib/bulk-import";
import type { Role } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const role = new URL(request.url).searchParams.get("role") as Role | null;
  if (role !== "LEARNER" && role !== "FACILITATOR") {
    return new Response("Invalid role", { status: 400 });
  }
  if (!canManageRole(session.user.role, role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const flags = await getFlags(session.user.organizationId);
  const emailOptional = role === "LEARNER" ? flags.learner_email_optional : flags.facilitator_email_optional;

  const buffer = workbookToBuffer(buildTemplateWorkbook(role, emailOptional));
  const filename = role === "LEARNER" ? "learners-template.xlsx" : "facilitators-template.xlsx";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
