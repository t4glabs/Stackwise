import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/flags";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/progress-bar";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { AddCohortToggle } from "@/components/add-cohort-toggle";

function formatRange(start: Date | null, end: Date | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return start ? `From ${fmt(start)}` : `Until ${fmt(end!)}`;
}

// Derived from dates alone — cohorts don't have a stored status, and this is the
// same "batch is running/hasn't started/wrapped up" read an admin would do by eye.
function deriveStatus(start: Date | null, end: Date | null): "Upcoming" | "Active" | "Ended" {
  const now = new Date();
  if (start && start > now) return "Upcoming";
  if (end && end < now) return "Ended";
  return "Active";
}

export default async function AdminCohortsPage() {
  const session = await auth();
  const organizationId = session!.user.organizationId;

  const enabled = await isFeatureEnabled(organizationId, "cohorts");
  if (!enabled) notFound();

  const cohorts = await prisma.cohort.findMany({
    where: { organizationId },
    include: {
      facilitators: { include: { facilitator: { select: { name: true } } } },
      members: { select: { learnerId: true } },
      // Which courses this cohort actually follows (CohortCourse) — separate from
      // enrollments, since a freshly attached course has no enrollments yet if the
      // cohort has no members, but should still show up here.
      courses: { include: { course: { select: { id: true, title: true } } } },
      enrollments: { select: { status: true } },
    },
    orderBy: [{ startDate: "desc" }, { name: "asc" }],
  });

  const allCohorts = cohorts.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        {/* div, not p — Eyebrow already renders a <p>, and InfoTooltip's panel is a
            <div>; nesting either inside a <p> is invalid HTML and causes a real
            hydration mismatch. See DESIGN_SYSTEM.md's InfoTooltip note. */}
        <div className="flex items-center gap-1.5">
          <Eyebrow>Cohorts</Eyebrow>
          <InfoTooltip label="What is a cohort?">
            <p>
              A cohort is a <strong>label</strong>, not a permission — it groups learners together
              (e.g. &quot;March 2026 Batch&quot;) purely for reporting.
            </p>
            <p className="mt-2">
              Cohorts aren&apos;t tied to a single course — the same cohort can span several
              courses in a program, and this page rolls up every one of them so you can see how a
              batch is doing across everything it&apos;s enrolled in, in one place.
            </p>
            <p className="mt-2">
              By itself, a cohort is just a label — it doesn&apos;t restrict anything. Optionally,
              a facilitator can be scoped to one or more cohorts (from that facilitator&apos;s own
              page) so they only see that cohort&apos;s members, wherever they&apos;re enrolled.
            </p>
          </InfoTooltip>
        </div>
        <p className="mt-1.5 max-w-2xl text-sm text-grey-700">
          Every batch across every course, in one place — status, who&apos;s running it, and how
          far along it is.
        </p>
      </div>

      <AddCohortToggle allCohorts={allCohorts} />

      {cohorts.length === 0 ? (
        <p className="text-sm text-grey-600">No cohorts yet — add one above to get started.</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-grey-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200 bg-grey-50 text-left text-xs font-semibold uppercase tracking-wide text-grey-600">
                <th className="px-5 py-3">Cohort</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3">Courses</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Facilitators</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Progress</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((cohort) => {
                const enrolledCount = cohort.enrollments.length;
                const completedCount = cohort.enrollments.filter((e) => e.status === "COMPLETED").length;
                const percent = enrolledCount ? (completedCount / enrolledCount) * 100 : 0;
                const status = deriveStatus(cohort.startDate, cohort.endDate);
                const range = formatRange(cohort.startDate, cohort.endDate);

                return (
                  <tr key={cohort.id} className="border-b border-grey-200 last:border-0 hover:bg-grey-50/60">
                    <td className="px-5 py-3.5 font-medium text-ink">
                      <Link href={`/admin/cohorts/${cohort.id}`} className="text-accent hover:underline">
                        {cohort.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-grey-600">{cohort.members.length}</td>
                    <td className="px-4 py-3.5">
                      {cohort.courses.length === 0 ? (
                        <span className="text-grey-400">None yet</span>
                      ) : (
                        <div className="flex flex-wrap gap-x-1 gap-y-1">
                          {cohort.courses.map((cc, i) => (
                            <span key={cc.course.id} className="whitespace-nowrap">
                              <Link href={`/admin/courses/${cc.course.id}`} className="text-accent hover:underline">
                                {cc.course.title}
                              </Link>
                              {i < cohort.courses.length - 1 ? "," : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant={status === "Active" ? "accent" : status === "Ended" ? "neutral" : "warning"}
                      >
                        {status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-grey-600">
                      {cohort.facilitators.length === 0
                        ? "—"
                        : cohort.facilitators.map((f) => f.facilitator.name).join(", ")}
                    </td>
                    <td className="px-4 py-3.5 text-grey-600">{range ?? "—"}</td>
                    <td className="w-48 px-4 py-3.5">
                      <ProgressBar percent={percent} />
                      <p className="mt-0.5 text-xs text-grey-500">
                        {enrolledCount} enrolled, {completedCount} completed
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
