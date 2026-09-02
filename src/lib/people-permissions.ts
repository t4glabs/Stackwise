import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/flags";
import type { Role } from "@/generated/prisma/client";

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
