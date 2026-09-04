"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type CohortFacilitatorState = { ok: true } | { ok: false; error: string } | undefined;

// Admin-only, deliberately — unlike creating a cohort (open to facilitators too,
// since it's just a label), linking a facilitator to one is a real access grant: it
// determines whose data that person can see. A facilitator can't grant themselves
// visibility into a cohort by linking themselves to it.
async function assertAdmin() {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Not signed in." };
  if (session.user.role !== "ADMIN") return { ok: false as const, error: "Only admins can do this." };
  return { ok: true as const, session };
}

function revalidateFacilitatorSurfaces(facilitatorId: string, cohortId: string) {
  revalidatePath("/admin/people");
  revalidatePath(`/admin/people/facilitators/${facilitatorId}`);
  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath("/facilitator");
}

export async function linkCohortFacilitatorAction(
  facilitatorId: string,
  cohortId: string
): Promise<CohortFacilitatorState> {
  const check = await assertAdmin();
  if (!check.ok) return check;

  const [facilitator, cohort] = await Promise.all([
    prisma.user.findFirst({
      where: { id: facilitatorId, organizationId: check.session.user.organizationId, role: "FACILITATOR" },
    }),
    prisma.cohort.findFirst({
      where: { id: cohortId, organizationId: check.session.user.organizationId },
    }),
  ]);
  if (!facilitator) return { ok: false, error: "Facilitator not found." };
  if (!cohort) return { ok: false, error: "Cohort not found." };

  await prisma.cohortFacilitator.upsert({
    where: { cohortId_facilitatorId: { cohortId, facilitatorId } },
    create: { cohortId, facilitatorId },
    update: {},
  });

  revalidateFacilitatorSurfaces(facilitatorId, cohortId);
  return { ok: true };
}

export async function unlinkCohortFacilitatorAction(
  facilitatorId: string,
  cohortId: string
): Promise<CohortFacilitatorState> {
  const check = await assertAdmin();
  if (!check.ok) return check;

  // Same org check as linkCohortFacilitatorAction — without it, an admin could
  // unlink a facilitator from a cohort belonging to a different organization
  // entirely, just by knowing the IDs.
  const [facilitator, cohort] = await Promise.all([
    prisma.user.findFirst({
      where: { id: facilitatorId, organizationId: check.session.user.organizationId, role: "FACILITATOR" },
    }),
    prisma.cohort.findFirst({
      where: { id: cohortId, organizationId: check.session.user.organizationId },
    }),
  ]);
  if (!facilitator) return { ok: false, error: "Facilitator not found." };
  if (!cohort) return { ok: false, error: "Cohort not found." };

  await prisma.cohortFacilitator.deleteMany({ where: { cohortId, facilitatorId } });

  revalidateFacilitatorSurfaces(facilitatorId, cohortId);
  return { ok: true };
}
