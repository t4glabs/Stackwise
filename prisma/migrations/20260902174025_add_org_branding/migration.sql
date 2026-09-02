-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "brandName" TEXT NOT NULL DEFAULT 'WeLive Learning';
ALTER TABLE "Organization" ADD COLUMN "accentColor" TEXT NOT NULL DEFAULT '#7358b3';
ALTER TABLE "Organization" ADD COLUMN "heroHeading" TEXT NOT NULL DEFAULT 'Courses and transition programs, in one place.';
ALTER TABLE "Organization" ADD COLUMN "heroDescription" TEXT NOT NULL DEFAULT 'Every course here is written and maintained in our wiki. This is where you enroll, track progress, and pick up where you left off.';
ALTER TABLE "Organization" ADD COLUMN "wikiLinkLabel" TEXT NOT NULL DEFAULT 'the wiki';
