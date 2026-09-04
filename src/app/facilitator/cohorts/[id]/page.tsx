import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/flags";
import { canManageCohort } from "@/lib/people-permissions";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { CohortDetailPanel, type CohortMemberRow, type CohortCourseRow } from "@/components/cohort-detail-panel";
import { ArrowLeft } from "lucide-react";

function formatRange(start: Date | null, end: Date | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return start ? `From ${fmt(start)}` : `Until ${fmt(end!)}`;
}

// Not under /admin — this is how a cohort-restricted facilitator reaches the same
// members/courses management as the admin cohort page, scoped to a cohort they
// actually manage. canManageCohort is the real gate (checked here, and again inside
// every action CohortDetailPanel calls) — reaching this URL for a cohort you don't
// manage 404s, same pattern as the certificate page's own permission check.
export default async function FacilitatorCohortDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const organizationId = session!.user.organizationId;

  const enabled = await isFeatureEnabled(organizationId, "cohorts");
  if (!enabled) notFound();

  const allowed = await canManageCohort(session!.user.id, session!.user.role, id);
  if (!allowed) notFound();

  const cohort = await prisma.cohort.findFirst({
    where: { id, organizationId },
    include: {
      members: { include: { learner: true }, orderBy: { learner: { name: "asc" } } },
      courses: { include: { course: true }, orderBy: { course: { title: "asc" } } },
      enrollments: { select: { courseId: true, status: true } },
    },
  });
  if (!cohort) notFound();

  const [allCourses, emailOptional] = await Promise.all([
    prisma.course.findMany({
      where: { organizationId, published: true },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    isFeatureEnabled(organizationId, "learner_email_optional"),
  ]);

  const statsByCourseId = new Map<string, { enrolledCount: number; completedCount: number }>();
  for (const e of cohort.enrollments) {
    const s = statsByCourseId.get(e.courseId) ?? { enrolledCount: 0, completedCount: 0 };
    s.enrolledCount += 1;
    if (e.status === "COMPLETED") s.completedCount += 1;
    statsByCourseId.set(e.courseId, s);
  }

  const members: CohortMemberRow[] = cohort.members.map((m) => ({
    id: m.learner.id,
    name: m.learner.name,
    identifier: m.learner.email ?? m.learner.username,
  }));

  // Not linkable — /admin/courses isn't reachable by a facilitator, cohort-restricted
  // or not.
  const courses: CohortCourseRow[] = cohort.courses.map((cc) => ({
    id: cc.course.id,
    title: cc.course.title,
    enrolledCount: statsByCourseId.get(cc.course.id)?.enrolledCount ?? 0,
    completedCount: statsByCourseId.get(cc.course.id)?.completedCount ?? 0,
    linkable: false,
  }));

  const attachedCourseIds = new Set(cohort.courses.map((cc) => cc.course.id));
  const availableCourses = allCourses.filter((c) => !attachedCourseIds.has(c.id));

  return (
    <Container className="flex flex-col gap-6 py-12">
      <Link
        href="/facilitator"
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-grey-600 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Your courses
      </Link>

      <div>
        <Eyebrow className="mb-1.5">Your cohort</Eyebrow>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">{cohort.name}</h1>
        {formatRange(cohort.startDate, cohort.endDate) ? (
          <p className="mt-1 text-sm text-grey-600">{formatRange(cohort.startDate, cohort.endDate)}</p>
        ) : null}
      </div>

      <CohortDetailPanel
        cohortId={cohort.id}
        members={members}
        courses={courses}
        availableCourses={availableCourses}
        emailOptional={emailOptional}
      />
    </Container>
  );
}
