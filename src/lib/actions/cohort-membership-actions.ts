"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/flags";
import { canManageCohort } from "@/lib/people-permissions";
import { addCohortMember, removeCohortMember, attachCourseToCohort, detachCourseFromCohort } from "@/lib/cohort-sync";
import { createUser, type CreateUserState } from "@/lib/actions/user-actions";

export type CohortMembershipState = { ok: true } | { ok: false; error: string } | undefined;

function revalidateCohortSurfaces(cohortId: string) {
  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath("/facilitator");
}

async function assertCanManageCohort(cohortId: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Not signed in." };

  const allowed = await canManageCohort(session.user.id, session.user.role, cohortId);
  if (!allowed) return { ok: false as const, error: "You don't manage this cohort." };

  return { ok: true as const, session };
}

export async function addCohortMemberAction(
  cohortId: string,
  learnerId: string,
  _prevState: CohortMembershipState
): Promise<CohortMembershipState> {
  const check = await assertCanManageCohort(cohortId);
  if (!check.ok) return check;

  const learner = await prisma.user.findFirst({
    where: { id: learnerId, organizationId: check.session.user.organizationId, role: "LEARNER" },
  });
  if (!learner) return { ok: false, error: "Learner not found." };

  // Every course this cohort already follows gets an enrollment created for them —
  // see lib/cohort-sync.ts.
  await addCohortMember(cohortId, learnerId);

  revalidateCohortSurfaces(cohortId);
  return { ok: true };
}

export async function removeCohortMemberAction(cohortId: string, learnerId: string): Promise<CohortMembershipState> {
  const check = await assertCanManageCohort(cohortId);
  if (!check.ok) return check;

  // Non-destructive — see lib/cohort-sync.ts. Existing enrollments (and progress)
  // aren't touched, this only stops future auto-enrollment.
  await removeCohortMember(cohortId, learnerId);

  revalidateCohortSurfaces(cohortId);
  return { ok: true };
}

export async function attachCourseToCohortAction(
  cohortId: string,
  courseId: string,
  _prevState: CohortMembershipState
): Promise<CohortMembershipState> {
  const check = await assertCanManageCohort(cohortId);
  if (!check.ok) return check;

  const course = await prisma.course.findFirst({
    where: { id: courseId, organizationId: check.session.user.organizationId },
  });
  if (!course) return { ok: false, error: "Course not found." };

  await attachCourseToCohort(cohortId, courseId);

  revalidateCohortSurfaces(cohortId);
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true };
}

export async function detachCourseFromCohortAction(cohortId: string, courseId: string): Promise<CohortMembershipState> {
  const check = await assertCanManageCohort(cohortId);
  if (!check.ok) return check;

  await detachCourseFromCohort(cohortId, courseId);

  revalidateCohortSurfaces(cohortId);
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true };
}

// The "genuinely new person" half, mirroring createAndEnrollLearner — creates the
// account and adds them to this cohort in one step, so onboarding a batch doesn't
// mean juggling account creation and membership as two disconnected screens.
export async function createAndAddCohortMember(
  cohortId: string,
  _prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const check = await assertCanManageCohort(cohortId);
  if (!check.ok) return { ok: false, error: check.error };

  const emailOptional = await isFeatureEnabled(check.session.user.organizationId, "learner_email_optional");
  const result = await createUser("LEARNER", formData, emailOptional);
  if (!result || !result.ok) return result ?? { ok: false, error: "Something went wrong." };

  await addCohortMember(cohortId, result.id);

  revalidateCohortSurfaces(cohortId);
  return result;
}

export type CohortCandidate = { id: string; name: string; identifier: string };

// Who can be added to this cohort — same idea as searchEnrollableLearners, but for
// cohort membership rather than a single course's roster. Deliberately org-wide (not
// scoped by any *other* cohort) — this is the "who do I add" search, run by someone
// who already manages this cohort, not the narrowed search a cohort-restricted
// facilitator gets elsewhere (see course-roster-actions.ts).
export async function searchCohortCandidates(
  cohortId: string,
  query: string
): Promise<CohortCandidate[] | { error: string }> {
  const check = await assertCanManageCohort(cohortId);
  if (!check.ok) return { error: check.error };

  const q = query.trim().toLowerCase();
  if (!q) return [];

  const candidates = await prisma.user.findMany({
    where: {
      organizationId: check.session.user.organizationId,
      role: "LEARNER",
      cohortMemberships: { none: { cohortId } },
    },
    orderBy: { name: "asc" },
  });

  return candidates
    .filter(
      (learner) =>
        learner.name.toLowerCase().includes(q) ||
        learner.username.toLowerCase().includes(q) ||
        (learner.email?.toLowerCase().includes(q) ?? false)
    )
    .slice(0, 20)
    .map((learner) => ({ id: learner.id, name: learner.name, identifier: learner.email ?? learner.username }));
}
