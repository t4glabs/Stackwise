import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";

// Admins can manage facilitators and learners; facilitators can only manage learners.
export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "ADMIN") return targetRole === "FACILITATOR" || targetRole === "LEARNER";
  if (actorRole === "FACILITATOR") return targetRole === "LEARNER";
  return false;
}

// Admins can manage any course's roster; facilitators only the courses they're
// actually assigned to (CourseFacilitator) — mirrors who can already see a course's
// enrollment table today.
export async function canManageCourseRoster(
  userId: string,
  role: Role,
  courseId: string
): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role !== "FACILITATOR") return false;

  const assignment = await prisma.courseFacilitator.findUnique({
    where: { courseId_facilitatorId: { courseId, facilitatorId: userId } },
  });
  return Boolean(assignment);
}
