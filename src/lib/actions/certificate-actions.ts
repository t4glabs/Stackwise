"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageCourseRoster } from "@/lib/people-permissions";

export type CertificateActionState = { ok: true } | { ok: false; error: string } | undefined;

// A manual override for a facilitator/admin who manages this course's roster — separate
// from maybeIssueCertificate's automatic path (see lib/certificates.ts). Deliberately
// ignores the certificates flag and the course's certificateEnabled toggle: those only
// govern *automatic* issuance, but staff who manage a course's roster can always decide
// a specific learner earned one, e.g. after re-enabling the feature retroactively or for
// a course that doesn't use auto-certificates at all. Still requires the enrollment to
// actually be COMPLETED — can't issue one for someone who hasn't finished.
export async function issueCertificateAction(
  learnerId: string,
  courseId: string,
  coursePath: string
): Promise<CertificateActionState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.organizationId !== session.user.organizationId) {
    return { ok: false, error: "Course not found." };
  }

  const allowed = await canManageCourseRoster(session.user.id, session.user.role, courseId);
  if (!allowed) return { ok: false, error: "You don't manage this course." };

  const enrollment = await prisma.enrollment.findUnique({
    where: { learnerId_courseId: { learnerId, courseId } },
  });
  if (!enrollment || enrollment.status !== "COMPLETED") {
    return { ok: false, error: "This learner hasn't completed the course yet." };
  }

  await prisma.certificate.upsert({
    where: { learnerId_courseId: { learnerId, courseId } },
    create: { learnerId, courseId },
    update: {},
  });

  revalidatePath(coursePath);
  return { ok: true };
}

// Admin-only: facilitators can issue but not take a certificate back — matches the
// asymmetry already used for people management (canManageRole).
export async function revokeCertificateAction(
  certificateId: string,
  coursePath: string
): Promise<CertificateActionState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false, error: "Only admins can revoke a certificate." };
  }

  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: { course: true },
  });
  if (!certificate || certificate.course.organizationId !== session.user.organizationId) {
    return { ok: false, error: "Certificate not found." };
  }

  await prisma.certificate.delete({ where: { id: certificateId } });

  revalidatePath(coursePath);
  return { ok: true };
}
