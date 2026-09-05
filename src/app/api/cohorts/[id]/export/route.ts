import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageCohort } from "@/lib/people-permissions";
import { buildCohortRosterWorkbook, type CohortRosterRow } from "@/lib/cohort-export";
import { workbookToBuffer } from "@/lib/bulk-import";
import { slugify } from "@/lib/slugify";

// GET /api/cohorts/[id]/export -> that cohort's roster as a .xlsx, one row per
// member with an overall percent plus a per-course breakdown. Shared between admin
// and facilitator — canManageCohort is the same gate every other cohort action uses,
// re-checked here regardless of which page's "Download roster" link sent the request.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const allowed = await canManageCohort(session.user.id, session.user.role, id);
  if (!allowed) {
    return new Response("Not found", { status: 404 });
  }

  const cohort = await prisma.cohort.findUnique({
    where: { id },
    include: {
      members: { include: { learner: true }, orderBy: { learner: { name: "asc" } } },
      courses: { include: { course: { select: { id: true, title: true } } }, orderBy: { course: { title: "asc" } } },
    },
  });
  if (!cohort) {
    return new Response("Not found", { status: 404 });
  }

  const courseIds = cohort.courses.map((cc) => cc.course.id);
  const learnerIds = cohort.members.map((m) => m.learnerId);

  const [lessonsByCourseRaw, completedRows, certifiedLearnerIds] = await Promise.all([
    prisma.lesson.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds }, hidden: false }, _count: { _all: true } }),
    prisma.progress.findMany({
      where: { learnerId: { in: learnerIds }, completedAt: { not: null }, lesson: { courseId: { in: courseIds }, hidden: false } },
      select: { learnerId: true, lesson: { select: { courseId: true } } },
    }),
    prisma.certificate.groupBy({ by: ["learnerId"], where: { learnerId: { in: learnerIds }, courseId: { in: courseIds } } }),
  ]);

  const totalByCourseId = new Map(lessonsByCourseRaw.map((l) => [l.courseId, l._count._all]));
  const totalLessonsOverall = lessonsByCourseRaw.reduce((sum, l) => sum + l._count._all, 0);
  const certifiedLearnerIdSet = new Set(certifiedLearnerIds.map((c) => c.learnerId));

  // learnerId -> courseId -> completed count, built once from a flat query rather
  // than one query per member — same reasoning as every other cohort-progress query.
  const doneByLearnerCourse = new Map<string, Map<string, number>>();
  for (const row of completedRows) {
    const courseId = row.lesson.courseId;
    let byCourse = doneByLearnerCourse.get(row.learnerId);
    if (!byCourse) {
      byCourse = new Map();
      doneByLearnerCourse.set(row.learnerId, byCourse);
    }
    byCourse.set(courseId, (byCourse.get(courseId) ?? 0) + 1);
  }

  const rows: CohortRosterRow[] = cohort.members.map((m) => {
    const byCourse = doneByLearnerCourse.get(m.learnerId);
    const overallDone = byCourse ? Array.from(byCourse.values()).reduce((sum, n) => sum + n, 0) : 0;
    return {
      name: m.learner.name,
      identifier: m.learner.email ?? m.learner.username,
      overallPercent: totalLessonsOverall ? (overallDone / totalLessonsOverall) * 100 : 0,
      hasCertificate: certifiedLearnerIdSet.has(m.learnerId),
      perCourse: courseIds.map((courseId) => {
        const total = totalByCourseId.get(courseId) ?? 0;
        const done = byCourse?.get(courseId) ?? 0;
        return total ? (done / total) * 100 : 0;
      }),
    };
  });

  const courseTitles = cohort.courses.map((cc) => cc.course.title);
  const workbook = buildCohortRosterWorkbook(cohort.name, courseTitles, rows);
  const buffer = workbookToBuffer(workbook);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slugify(cohort.name)}-roster.xlsx"`,
    },
  });
}
