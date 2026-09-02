"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/flags";
import { maybeIssueCertificate } from "@/lib/certificates";

async function requireLearner() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session.user;
}

export async function enrollInCourse(courseId: string, coursePath: string) {
  const user = await requireLearner();
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });

  const allowed = await isFeatureEnabled(course.organizationId, "self_enrollment");
  if (!allowed) throw new Error("Self-enrollment is turned off for this organization");

  await prisma.enrollment.upsert({
    where: { learnerId_courseId: { learnerId: user.id, courseId } },
    create: { learnerId: user.id, courseId, source: "SELF", status: "ACTIVE" },
    update: {},
  });

  revalidatePath(coursePath);
}

export async function markLessonComplete(lessonId: string, coursePath: string) {
  const user = await requireLearner();

  await prisma.progress.upsert({
    where: { learnerId_lessonId: { learnerId: user.id, lessonId } },
    create: { learnerId: user.id, lessonId, viewedAt: new Date(), completedAt: new Date() },
    update: { completedAt: new Date() },
  });

  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
  await maybeCompleteCourse(user.id, lesson.courseId);

  revalidatePath(coursePath);
}

export async function markCourseComplete(courseId: string, coursePath: string) {
  const user = await requireLearner();

  // External-link courses have no explicit enroll step (see the course page), so this
  // is often the first record we have of the learner touching the course at all.
  await prisma.enrollment.upsert({
    where: { learnerId_courseId: { learnerId: user.id, courseId } },
    create: {
      learnerId: user.id,
      courseId,
      source: "SELF",
      status: "COMPLETED",
      completedAt: new Date(),
    },
    update: { status: "COMPLETED", completedAt: new Date() },
  });
  await maybeIssueCertificate(user.id, courseId);

  revalidatePath(coursePath);
}

async function maybeCompleteCourse(learnerId: string, courseId: string) {
  const [lessonCount, completedCount] = await Promise.all([
    prisma.lesson.count({ where: { courseId } }),
    prisma.progress.count({
      where: { learnerId, completedAt: { not: null }, lesson: { courseId } },
    }),
  ]);

  if (lessonCount > 0 && completedCount >= lessonCount) {
    await prisma.enrollment.update({
      where: { learnerId_courseId: { learnerId, courseId } },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await maybeIssueCertificate(learnerId, courseId);
  }
}
