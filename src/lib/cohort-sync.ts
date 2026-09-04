import { prisma } from "@/lib/prisma";

// Same shape as Moodle's "cohort sync" enrolment method: attach a course to a cohort
// and every current member gets enrolled; add a member to a cohort and they get
// enrolled in every course it already follows. This is what makes a cohort a real,
// standing group instead of just a label picked at enrollment time — see the Cohort
// model's own comment in schema.prisma.
//
// Everything here is deliberately non-destructive: detaching a course or removing a
// member never un-enrolls anyone or deletes progress — it only stops *future* sync.
// Same principle already used for deleting a cohort entirely (see
// deleteCohortAction in cohort-actions.ts) and for course-roster.ts re-enrollment.

// Enrolling a member into a course the cohort follows shouldn't clobber an existing,
// different cohort tag on that enrollment — same non-destructive principle as
// assignLearnerToCourse's own upsert (course-roster-actions.ts). Only ever fills in
// a cohort tag that's currently unset.
async function ensureEnrolled(learnerId: string, courseId: string, cohortId: string) {
  const existing = await prisma.enrollment.findUnique({
    where: { learnerId_courseId: { learnerId, courseId } },
  });
  if (existing) {
    if (!existing.cohortId) {
      await prisma.enrollment.update({ where: { id: existing.id }, data: { cohortId } });
    }
    return;
  }
  try {
    await prisma.enrollment.create({
      data: { learnerId, courseId, cohortId, source: "ASSIGNED", status: "ACTIVE" },
    });
  } catch (err) {
    // Two sync calls can race between the findUnique above and this create (e.g. an
    // admin and a cohort-scoped facilitator both touching the same cohort at once).
    // The learnerId+courseId unique constraint is the real guard against a duplicate
    // row; a P2002 here just means the other call won the race, which is exactly the
    // "already enrolled" outcome we want, not a real failure.
    const isUniqueViolation =
      typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
    if (!isUniqueViolation) throw err;
  }
}

// Attach a course to a cohort — every current member gets enrolled (or, if already
// enrolled with no cohort tag, tagged with this one). Idempotent: attaching an
// already-attached course is a no-op, not an error.
export async function attachCourseToCohort(cohortId: string, courseId: string) {
  await prisma.cohortCourse.upsert({
    where: { cohortId_courseId: { cohortId, courseId } },
    create: { cohortId, courseId },
    update: {},
  });

  const members = await prisma.cohortMember.findMany({
    where: { cohortId },
    select: { learnerId: true },
  });
  for (const { learnerId } of members) {
    await ensureEnrolled(learnerId, courseId, cohortId);
  }
}

// Detach a course from a cohort — stops future sync only, doesn't touch anyone
// already enrolled through it.
export async function detachCourseFromCohort(cohortId: string, courseId: string) {
  await prisma.cohortCourse.deleteMany({ where: { cohortId, courseId } });
}

// Add a member to a cohort — enrolls them into every course the cohort already
// follows. Idempotent: adding an existing member is a no-op.
export async function addCohortMember(cohortId: string, learnerId: string) {
  await prisma.cohortMember.upsert({
    where: { cohortId_learnerId: { cohortId, learnerId } },
    create: { cohortId, learnerId },
    update: {},
  });

  const courses = await prisma.cohortCourse.findMany({
    where: { cohortId },
    select: { courseId: true },
  });
  for (const { courseId } of courses) {
    await ensureEnrolled(learnerId, courseId, cohortId);
  }
}

// Remove a member from a cohort — stops future sync only, doesn't un-enroll them
// from anything they're already enrolled in.
export async function removeCohortMember(cohortId: string, learnerId: string) {
  await prisma.cohortMember.deleteMany({ where: { cohortId, learnerId } });
}
