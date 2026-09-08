import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageEnrollment } from "@/lib/people-permissions";
import { readSubmissionFile } from "@/lib/submission-storage";

// GET /api/submissions/[id]/download — the only path to a submitted file. Allowed
// for the learner who uploaded it, or whoever can already manage that enrollment
// (same canManageEnrollment gate as every other per-enrollment action) — never a
// public/guessable URL, since this is about one specific learner's work.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { enrollment: true },
  });
  if (!submission) return new Response("Not found", { status: 404 });

  const isOwner = submission.enrollment.learnerId === session.user.id;
  const canReview = isOwner
    ? true
    : await canManageEnrollment(session.user.id, session.user.role, {
        courseId: submission.enrollment.courseId,
        cohortId: submission.enrollment.cohortId,
      });
  if (!canReview) return new Response("Not found", { status: 404 });

  const buffer = await readSubmissionFile(submission.storedPath);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": submission.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${submission.fileName.replace(/"/g, "")}"`,
    },
  });
}
