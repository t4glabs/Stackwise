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

  // Matches the course-config UI's own promise ("Off means learners can't see or
  // enroll in it") — the enroll button is already hidden for an unpublished course,
  // this is the server-side half of that guarantee.
  if (!course.published) throw new Error("This course isn't open for enrollment.");

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

  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });

  // A lesson can go hidden (its page was deleted in BookStack) after a learner has
  // already loaded the page but before they submit — the syllabus/lesson pages
  // already filter these out, this is the server-side half of that gate.
  if (lesson.hidden) throw new Error("This lesson is no longer available.");

  // The lesson page itself only ever renders this action's form for an enrolled
  // learner (redirects otherwise) — this is the server-side half of that gate.
  // Without it, maybeCompleteCourse below would try to update an enrollment row
  // that was never created and throw (Prisma P2025) on a single-lesson course.
  const enrollment = await prisma.enrollment.findUnique({
    where: { learnerId_courseId: { learnerId: user.id, courseId: lesson.courseId } },
  });
  if (!enrollment) throw new Error("You're not enrolled in this course.");

  await prisma.progress.upsert({
    where: { learnerId_lessonId: { learnerId: user.id, lessonId } },
    create: { learnerId: user.id, lessonId, viewedAt: new Date(), completedAt: new Date() },
    update: { completedAt: new Date() },
  });

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
    prisma.lesson.count({ where: { courseId, hidden: false } }),
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
