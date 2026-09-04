import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/flags";
import type { Role } from "@/generated/prisma/client";

// Whether this facilitator has opted into cohort-scoped access at all — the moment
// they're linked to even one cohort, they stop getting any of this file's "no
// explicit assignment needed" fallbacks. Without this, an org-wide default (like
// facilitator_assignment being off) would silently undo the entire point of scoping
// a specific facilitator to one cohort — the whole reason someone turns this on.
async function isCohortScoped(facilitatorId: string): Promise<boolean> {
  const link = await prisma.cohortFacilitator.findFirst({ where: { facilitatorId } });
  return Boolean(link);
}

// Admins can manage any cohort *in their own organization*. Facilitators only if
// explicitly linked (CohortFacilitator) — unlike course access, there's no "flag off
// = manage anything" fallback here; managing a cohort is always an explicit,
// admin-granted link, never a default. The org check applies to both roles: without
// it, an admin (or a cohortId guessed/leaked from elsewhere) could reach a cohort
// belonging to a different organization entirely — this app is multi-tenant, so that
// would be a real cross-org data leak/tamper path, not just a permissions nicety.
export async function canManageCohort(userId: string, role: Role, cohortId: string): Promise<boolean> {
  if (role !== "ADMIN" && role !== "FACILITATOR") return false;

  const [actor, cohort] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } }),
    prisma.cohort.findUnique({ where: { id: cohortId }, select: { organizationId: true } }),
  ]);
  if (!actor || !cohort || actor.organizationId !== cohort.organizationId) return false;

  if (role === "ADMIN") return true;

  const link = await prisma.cohortFacilitator.findUnique({
    where: { cohortId_facilitatorId: { cohortId, facilitatorId: userId } },
  });
  return Boolean(link);
}

// Can this facilitator/admin take an action on this specific *learner* — reset their
// password, etc. — as opposed to a specific course or enrollment. Deliberately
// conservative: a facilitator who has never been cohort-scoped keeps exactly the
// access they already had (this file never scoped learner-level actions by course
// before cohorts existed, and turning the cohorts module on for an org shouldn't
// retroactively tighten anyone who hasn't been explicitly opted in). Only a
// facilitator with at least one cohort link gets narrowed — to exactly their
// cohorts' membership, nothing else.
export async function canManageLearner(actorId: string, actorRole: Role, learnerId: string): Promise<boolean> {
  if (actorRole !== "ADMIN" && actorRole !== "FACILITATOR") return false;

  const [actor, learner] = await Promise.all([
    prisma.user.findUnique({ where: { id: actorId }, select: { organizationId: true } }),
    prisma.user.findUnique({ where: { id: learnerId }, select: { organizationId: true } }),
  ]);
  if (!actor || !learner || actor.organizationId !== learner.organizationId) return false;

  if (actorRole === "ADMIN") return true;

  if (!(await isCohortScoped(actorId))) return true;

  const sharedCohort = await prisma.cohortMember.findFirst({
    where: {
      learnerId,
      cohort: { facilitators: { some: { facilitatorId: actorId } } },
    },
  });
  return Boolean(sharedCohort);
}

// Can this facilitator/admin manage this specific *enrollment* — one course, one
// learner. Used where "which course" alone isn't precise enough (per-learner rows in
// a roster, certificates). Same conservative rule as canManageLearner: only
// cohort-scoped facilitators are narrowed at all; a facilitator with course access
// but no cohort links behaves exactly as canManageCourseRoster already did.
export async function canManageEnrollment(
  actorId: string,
  actorRole: Role,
  enrollment: { courseId: string; cohortId: string | null }
): Promise<boolean> {
  if (actorRole !== "ADMIN" && actorRole !== "FACILITATOR") return false;

  // canManageCourseRoster already org-checks actorId against the course, and
  // resolves ADMIN vs FACILITATOR correctly — reusing it here (instead of a
  // separate top-level "ADMIN always true") is what makes the org check apply to
  // admins too, not just facilitators.
  const directCourseAccess = await canManageCourseRoster(actorId, actorRole, enrollment.courseId);
  if (actorRole === "ADMIN") return directCourseAccess;

  if (!(await isCohortScoped(actorId))) return directCourseAccess;

  // Cohort-scoped: direct course assignment still counts (a facilitator can
  // legitimately have both), but the course-level "no assignment needed" fallback
  // inside canManageCourseRoster does not — that fallback exists for facilitators
  // who were never scoped to begin with, not for ones explicitly narrowed to a
  // cohort. So the only other path is the enrollment's own cohort matching one this
  // facilitator manages.
  const hasDirectAssignment = await prisma.courseFacilitator.findUnique({
    where: { courseId_facilitatorId: { courseId: enrollment.courseId, facilitatorId: actorId } },
  });
  if (hasDirectAssignment) return true;

  if (!enrollment.cohortId) return false;
  return canManageCohort(actorId, actorRole, enrollment.cohortId);
}

// Admins can manage facilitators and learners; facilitators can only manage learners.
export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "ADMIN") return targetRole === "FACILITATOR" || targetRole === "LEARNER";
  if (actorRole === "FACILITATOR") return targetRole === "LEARNER";
  return false;
}

// Admins can manage any course's roster. Facilitators normally only the courses
// they're actually assigned to (CourseFacilitator) — but when an org has the
// facilitator_assignment flag off, there's no per-course scoping concept at all, so
// any facilitator can manage any course instead of being unable to manage *none*.
export async function canManageCourseRoster(
  userId: string,
  role: Role,
  courseId: string
): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role !== "FACILITATOR") return false;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return false;

  const assignmentScoped = await isFeatureEnabled(course.organizationId, "facilitator_assignment");
  if (!assignmentScoped) return true;

  const assignment = await prisma.courseFacilitator.findUnique({
    where: { courseId_facilitatorId: { courseId, facilitatorId: userId } },
  });
  return Boolean(assignment);
}
