"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageCourseRoster } from "@/lib/people-permissions";

export type CohortActionState = { ok: true } | { ok: false; error: string } | undefined;

// Cohorts are a batch/scheduling label, not a permission boundary — any facilitator
// who can already manage a course's roster can create or remove its cohorts, same as
// enrolling learners into it. See lib/certificates.ts / people-permissions.ts for the
// contrast with things that *do* gate access.
export async function createCohortAction(
  courseId: string,
  coursePath: string,
  _prevState: CohortActionState,
  formData: FormData
): Promise<CohortActionState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const allowed = await canManageCourseRoster(session.user.id, session.user.role, courseId);
  if (!allowed) return { ok: false, error: "You don't manage this course." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Give the cohort a name." };

  const facilitatorId = String(formData.get("facilitatorId") ?? "").trim() || null;
  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  const endDateRaw = String(formData.get("endDate") ?? "").trim();

  await prisma.cohort.create({
    data: {
      courseId,
      name,
      facilitatorId,
      startDate: startDateRaw ? new Date(startDateRaw) : null,
      endDate: endDateRaw ? new Date(endDateRaw) : null,
    },
  });

  revalidatePath(coursePath);
  return { ok: true };
}

export async function deleteCohortAction(
  cohortId: string,
  coursePath: string
): Promise<CohortActionState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const cohort = await prisma.cohort.findUnique({ where: { id: cohortId } });
  if (!cohort) return { ok: false, error: "Cohort not found." };

  const allowed = await canManageCourseRoster(session.user.id, session.user.role, cohort.courseId);
  if (!allowed) return { ok: false, error: "You don't manage this course." };

  // Deleting a cohort ungroups its learners rather than un-enrolling them.
  await prisma.enrollment.updateMany({ where: { cohortId }, data: { cohortId: null } });
  await prisma.cohort.delete({ where: { id: cohortId } });

  revalidatePath(coursePath);
  return { ok: true };
}
