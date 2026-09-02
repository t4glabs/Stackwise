-- AlterTable
ALTER TABLE "Course" ADD COLUMN "downloadableWorkbook" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "chapterTitle" TEXT;
