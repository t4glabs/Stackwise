import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

// Deliberately outside public/ — unlike a logo or favicon, a homework/assessment
// upload is about one specific learner and shouldn't be reachable by a guessed URL.
// The only way to it is the authenticated route in
// app/api/submissions/[id]/download, which checks the same permission rules as
// everywhere else a facilitator/admin looks at one learner's work.
const SUBMISSIONS_ROOT = path.join(process.cwd(), "private-uploads", "submissions");

const MAX_BYTES = 15 * 1024 * 1024; // 15MB — generous for a scanned page or a short doc, not a video
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function validateSubmissionFile(file: File): string | null {
  if (file.size === 0) return "Choose a file first.";
  if (file.size > MAX_BYTES) return `Keep it under ${Math.round(MAX_BYTES / (1024 * 1024))}MB.`;
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return "That file type isn't supported — try a PDF, Word/Excel doc, or a photo.";
  }
  return null;
}

// Stores under a random, unguessable subpath (not the original filename) so nothing
// about the on-disk layout leaks a learner's name/enrollment — the DB row is the only
// thing that maps a stored file back to who it belongs to.
export async function storeSubmissionFile(
  enrollmentId: string,
  file: File
): Promise<{ storedPath: string; sizeBytes: number }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const dir = path.join(SUBMISSIONS_ROOT, enrollmentId);
  await fs.mkdir(dir, { recursive: true });

  const ext = path.extname(file.name).slice(0, 12); // keep it short and sane
  const storedName = `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
  const storedPath = path.join(enrollmentId, storedName);
  await fs.writeFile(path.join(SUBMISSIONS_ROOT, storedPath), buffer);

  return { storedPath, sizeBytes: buffer.byteLength };
}

export async function readSubmissionFile(storedPath: string): Promise<Buffer> {
  return fs.readFile(path.join(SUBMISSIONS_ROOT, storedPath));
}
