-- Cohorts stop belonging to a single course and become an org-wide, reusable label —
-- the same cohort can now be picked when enrolling a learner into any course, not
-- just whichever course it was originally created from. SQLite can't ALTER a column's
-- foreign key target directly, so this rebuilds the table (standard SQLite pattern
-- for this project — see prisma/migrations/*/migration.sql for other examples).

-- CreateTable
CREATE TABLE "new_Cohort" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "facilitatorId" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    CONSTRAINT "Cohort_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cohort_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Backfill: every existing cohort's organizationId comes from the single course it
-- used to belong to.
INSERT INTO "new_Cohort" ("id", "organizationId", "name", "facilitatorId", "startDate", "endDate")
SELECT "Cohort"."id", "Course"."organizationId", "Cohort"."name", "Cohort"."facilitatorId", "Cohort"."startDate", "Cohort"."endDate"
FROM "Cohort"
JOIN "Course" ON "Course"."id" = "Cohort"."courseId";

DROP TABLE "Cohort";
ALTER TABLE "new_Cohort" RENAME TO "Cohort";

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_organizationId_name_key" ON "Cohort"("organizationId", "name");
