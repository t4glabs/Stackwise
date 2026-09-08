-- Manual completion approval: an org can turn on a flag (manual_completion_approval)
-- that holds an enrollment at 100% instead of auto-completing it until a
-- facilitator/admin approves or sends it back with a note. These columns are the
-- audit trail for that — no FK on the *ById columns, same bare-reference pattern as
-- User.createdById elsewhere in this schema.
ALTER TABLE "Enrollment" ADD COLUMN "completionApprovedAt" DATETIME;
ALTER TABLE "Enrollment" ADD COLUMN "completionApprovedById" TEXT;
ALTER TABLE "Enrollment" ADD COLUMN "revisionNote" TEXT;
ALTER TABLE "Enrollment" ADD COLUMN "revisionRequestedAt" DATETIME;
ALTER TABLE "Enrollment" ADD COLUMN "revisionRequestedById" TEXT;

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
