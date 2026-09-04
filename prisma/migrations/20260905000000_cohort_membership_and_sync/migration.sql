-- Cohorts become real, standing groups: membership (CohortMember) and which courses
-- they follow (CohortCourse) are now first-class relationships instead of being
-- derived purely from scattered Enrollment.cohortId tags. The old single
-- Cohort.facilitatorId (display-only, never wired into any permission check) is
-- replaced by a proper many-to-many CohortFacilitator table, matching how
-- CourseFacilitator already works — one real mechanism, used for both "who's running
-- this" display and actual access scoping, not two overlapping ones.
--
-- FK checks are off for this migration: the new tables below reference Cohort(id)
-- before Cohort itself gets rebuilt (to drop facilitatorId) further down, and SQLite
-- refuses to DROP a table that any other table's schema still declares a foreign key
-- against — even an empty one. Standard pattern for a SQLite table rebuild that has
-- dependents; re-enabled at the end, same as every DDL migration should leave it.
PRAGMA foreign_keys=OFF;

-- CreateTable
CREATE TABLE "CohortMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    CONSTRAINT "CohortMember_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CohortMember_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CohortMember_cohortId_learnerId_key" ON "CohortMember"("cohortId", "learnerId");

-- CreateTable
CREATE TABLE "CohortCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    CONSTRAINT "CohortCourse_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CohortCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CohortCourse_cohortId_courseId_key" ON "CohortCourse"("cohortId", "courseId");

-- CreateTable
CREATE TABLE "CohortFacilitator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT NOT NULL,
    "facilitatorId" TEXT NOT NULL,
    CONSTRAINT "CohortFacilitator_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CohortFacilitator_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CohortFacilitator_cohortId_facilitatorId_key" ON "CohortFacilitator"("cohortId", "facilitatorId");

-- Backfill: carry over any existing single facilitatorId into the new join table
-- before dropping the column.
INSERT INTO "CohortFacilitator" ("id", "cohortId", "facilitatorId")
SELECT lower(hex(randomblob(16))), "id", "facilitatorId"
FROM "Cohort"
WHERE "facilitatorId" IS NOT NULL;

-- Drop Cohort.facilitatorId — SQLite can't drop a column with a foreign key in place,
-- so rebuild the table (same pattern as the previous cohort migration).
CREATE TABLE "new_Cohort" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    CONSTRAINT "Cohort_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Cohort" ("id", "organizationId", "name", "startDate", "endDate")
SELECT "id", "organizationId", "name", "startDate", "endDate" FROM "Cohort";

DROP TABLE "Cohort";
ALTER TABLE "new_Cohort" RENAME TO "Cohort";

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_organizationId_name_key" ON "Cohort"("organizationId", "name");

PRAGMA foreign_keys=ON;
