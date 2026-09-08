"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/flags";
import { canManageEnrollment } from "@/lib/people-permissions";
import { maybeIssueCertificate } from "@/lib/certificates";
import { validateSubmissionFile, storeSubmissionFile } from "@/lib/submission-storage";
import type { Enrollment } from "@/generated/prisma/client";
import type { Session } from "next-auth";

export type UploadSubmissionState = { ok: true } | { ok: false; error: string } | undefined;

// Learner-only, and only onto their own enrollment — a submission is evidence for
// that one course, not a general-purpose file drop. Allowed at any point during the
// course, not just at 100%, so a learner can attach interim work too.
export async function uploadSubmissionAction(
  enrollmentId: string,
  coursePath: string,
  _prevState: UploadSubmissionState,
  formData: FormData
): Promise<UploadSubmissionState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment || enrollment.learnerId !== session.user.id) {
    return { ok: false, error: "Enrollment not found." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a file first." };
  const fileError = validateSubmissionFile(file);
  if (fileError) return { ok: false, error: fileError };

  const note = String(formData.get("note") ?? "").trim() || null;
  const { storedPath, sizeBytes } = await storeSubmissionFile(enrollmentId, file);

  await prisma.submission.create({
    data: {
      enrollmentId,
      fileName: file.name,
      storedPath,
      mimeType: file.type || null,
      sizeBytes,
      note,
    },
  });

  revalidatePath(coursePath);
  return { ok: true };
}

type ReviewCheck =
  | { ok: false; error: string }
  | { ok: true; session: Session; enrollment: Enrollment };

async function assertCanReview(enrollmentId: string): Promise<ReviewCheck> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) return { ok: false, error: "Enrollment not found." };

  const allowed = await canManageEnrollment(session.user.id, session.user.role, {
    courseId: enrollment.courseId,
    cohortId: enrollment.cohortId,
  });
  if (!allowed) return { ok: false, error: "You don't have permission to review this." };

  return { ok: true, session, enrollment };
}

export type ReviewActionState = { ok: true } | { ok: false; error: string } | undefined;

// Approving is the manual equivalent of what used to happen automatically at 100% —
// same status flip, same certificate call — just gated behind an explicit human
// decision instead of firing the moment the last lesson is marked done.
export async function approveCompletionAction(
  enrollmentId: string,
  coursePath: string
): Promise<ReviewActionState> {
  const check = await assertCanReview(enrollmentId);
  if (!check.ok) return check;
  const { session, enrollment } = check;

  const [lessonCount, doneCount] = await Promise.all([
    prisma.lesson.count({ where: { courseId: enrollment.courseId, hidden: false } }),
    prisma.progress.count({
      where: { learnerId: enrollment.learnerId, completedAt: { not: null }, lesson: { courseId: enrollment.courseId, hidden: false } },
    }),
  ]);
  if (lessonCount === 0 || doneCount < lessonCount) {
    return { ok: false, error: "This learner hasn't finished every lesson yet." };
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completionApprovedAt: new Date(),
      completionApprovedById: session.user.id,
      // A late approval supersedes any earlier "send it back" note — it's no longer
      // relevant once the work's been accepted.
      revisionNote: null,
      revisionRequestedAt: null,
      revisionRequestedById: null,
    },
  });
  await maybeIssueCertificate(enrollment.learnerId, enrollment.courseId);

  revalidatePath(coursePath);
  return { ok: true };
}

export async function requestRevisionAction(
  enrollmentId: string,
  coursePath: string,
  _prevState: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const check = await assertCanReview(enrollmentId);
  if (!check.ok) return check;
  const { session } = check;

  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { ok: false, error: "Say what needs another look." };

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      revisionNote: note,
      revisionRequestedAt: new Date(),
      revisionRequestedById: session.user.id,
    },
  });

  revalidatePath(coursePath);
  return { ok: true };
}

// Whether manual_completion_approval is on AND this enrollment has finished every
// lesson but hasn't been approved yet — the one condition both the learner's course
// page and the facilitator's review UI need to compute the same "pending" state from.
export async function isAwaitingReview(
  organizationId: string,
  enrollment: { status: string; courseId: string; learnerId: string; completionApprovedAt: Date | null }
): Promise<boolean> {
  if (enrollment.status === "COMPLETED") return false;
  const flagOn = await isFeatureEnabled(organizationId, "manual_completion_approval");
  if (!flagOn) return false;

  const [lessonCount, doneCount] = await Promise.all([
    prisma.lesson.count({ where: { courseId: enrollment.courseId, hidden: false } }),
    prisma.progress.count({
      where: { learnerId: enrollment.learnerId, completedAt: { not: null }, lesson: { courseId: enrollment.courseId, hidden: false } },
    }),
  ]);
  return lessonCount > 0 && doneCount >= lessonCount;
}
