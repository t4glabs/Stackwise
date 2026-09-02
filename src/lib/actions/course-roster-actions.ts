"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/flags";
import { canManageCourseRoster } from "@/lib/people-permissions";
import { createUser, type CreateUserState } from "@/lib/actions/user-actions";

export type EnrollableLearner = {
  id: string;
  name: string;
  username: string;
  email: string | null;
};

// One shared learner registry — this searches every learner in the org, not just
// people a given facilitator has touched before, and excludes anyone already enrolled
// in this course so results are always "who could newly be enrolled." Filtering
// happens in JS rather than a DB `contains` query because the app runs on SQLite in
// dev and Postgres in prod, and their case-insensitive `contains` behavior differs —
// this keeps search behavior identical on both without fighting that.
export async function searchEnrollableLearners(
  courseId: string,
  query: string
): Promise<EnrollableLearner[] | { error: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const allowed = await canManageCourseRoster(session.user.id, session.user.role, courseId);
  if (!allowed) return { error: "You don't manage this course." };

  const q = query.trim().toLowerCase();
  if (!q) return [];

  const candidates = await prisma.user.findMany({
    where: {
      organizationId: session.user.organizationId,
      role: "LEARNER",
      enrollments: { none: { courseId } },
    },
    orderBy: { name: "asc" },
  });

  return candidates
    .filter(
      (learner) =>
        learner.name.toLowerCase().includes(q) ||
        learner.username.toLowerCase().includes(q) ||
        (learner.email ?? "").toLowerCase().includes(q)
    )
    .slice(0, 8)
    .map((learner) => ({
      id: learner.id,
      name: learner.name,
      username: learner.username,
      email: learner.email,
    }));
}

export type AssignLearnerState = { ok: true } | { ok: false; error: string } | undefined;

// The "someone already in the system" half of enrollment — a facilitator/admin
// picking a search result. Distinct from enrollInCourse (self-service, learner-only)
// via source: "ASSIGNED".
export async function assignLearnerToCourse(
  learnerId: string,
  courseId: string,
  coursePath: string
): Promise<AssignLearnerState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const allowed = await canManageCourseRoster(session.user.id, session.user.role, courseId);
  if (!allowed) return { ok: false, error: "You don't manage this course." };

  const learner = await prisma.user.findFirst({
    where: { id: learnerId, organizationId: session.user.organizationId, role: "LEARNER" },
  });
  if (!learner) return { ok: false, error: "Learner not found." };

  await prisma.enrollment.upsert({
    where: { learnerId_courseId: { learnerId, courseId } },
    create: { learnerId, courseId, source: "ASSIGNED", status: "ACTIVE" },
    update: {},
  });

  revalidatePath(coursePath);
  return { ok: true };
}

// The "genuinely new person" half — creates the account (same validation/creation
// path as /admin/people) and enrolls them in one step, so a facilitator never has to
// juggle two disconnected screens for what is, to them, one action.
export async function createAndEnrollLearner(
  courseId: string,
  coursePath: string,
  _prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const allowed = await canManageCourseRoster(session.user.id, session.user.role, courseId);
  if (!allowed) return { ok: false, error: "You don't manage this course." };

  const emailOptional = await isFeatureEnabled(session.user.organizationId, "learner_email_optional");
  const result = await createUser("LEARNER", formData, emailOptional);
  if (!result || !result.ok) return result ?? { ok: false, error: "Something went wrong." };

  await prisma.enrollment.create({
    data: { learnerId: result.id, courseId, source: "ASSIGNED", status: "ACTIVE" },
  });

  revalidatePath(coursePath);
  return result;
}
