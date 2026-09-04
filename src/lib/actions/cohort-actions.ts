"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type CohortActionState = { ok: true } | { ok: false; error: string } | undefined;

// Every place a cohort can show up — kept in one spot so create/delete don't have to
// know which pages happen to render cohort data.
function revalidateCohortSurfaces(extraPath?: string) {
  revalidatePath("/admin/cohorts");
  revalidatePath("/facilitator");
  if (extraPath) revalidatePath(extraPath);
}

// Cohorts are a batch/scheduling label, not a permission boundary — any facilitator or
// admin can create one, same as they could already enroll a learner into any course.
// They're org-wide now, not owned by one course (see schema.prisma), so entering the
// name of a cohort that already exists just reuses it (upsert with a no-op update)
// instead of erroring or creating a confusing near-duplicate — that's what makes
// "the same cohort across multiple courses" actually usable from any course's enroll
// panel without a separate search-and-pick step.
export async function createCohortAction(
  coursePath: string,
  _prevState: CohortActionState,
  formData: FormData
): Promise<CohortActionState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };
  if (session.user.role !== "ADMIN" && session.user.role !== "FACILITATOR") {
    return { ok: false, error: "Only admins and facilitators can create cohorts." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Give the cohort a name." };

  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  const endDateRaw = String(formData.get("endDate") ?? "").trim();

  await prisma.cohort.upsert({
    where: {
      organizationId_name: { organizationId: session.user.organizationId, name },
    },
    create: {
      organizationId: session.user.organizationId,
      name,
      startDate: startDateRaw ? new Date(startDateRaw) : null,
      endDate: endDateRaw ? new Date(endDateRaw) : null,
    },
    // Reusing an existing cohort by name shouldn't silently overwrite its dates from
    // whatever a different course's form happened to have filled in. Facilitators are
    // linked separately, from a facilitator's own detail page (admin-only grant).
    update: {},
  });

  revalidateCohortSurfaces(coursePath);
  return { ok: true };
}

// Admin-only: deleting a cohort ungroups every learner it's attached to across every
// course it's used in (not un-enrolling them, just clearing the label) — a blast
// radius a facilitator managing a single course shouldn't be able to trigger now that
// cohorts aren't scoped to the course they happen to be looking at.
export async function deleteCohortAction(
  cohortId: string,
  coursePath?: string
): Promise<CohortActionState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };
  if (session.user.role !== "ADMIN") {
    return { ok: false, error: "Only admins can delete a cohort." };
  }

  const cohort = await prisma.cohort.findUnique({ where: { id: cohortId } });
  if (!cohort || cohort.organizationId !== session.user.organizationId) {
    return { ok: false, error: "Cohort not found." };
  }

  await prisma.enrollment.updateMany({ where: { cohortId }, data: { cohortId: null } });
  await prisma.cohort.delete({ where: { id: cohortId } });

  revalidateCohortSurfaces(coursePath);
  return { ok: true };
}
