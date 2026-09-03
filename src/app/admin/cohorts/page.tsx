import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/flags";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/progress-bar";
import { InfoTooltip } from "@/components/ui/info-tooltip";

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
    where: { course: { organizationId } },
    include: {
      course: { select: { id: true, title: true } },
      facilitator: { select: { name: true } },
      enrollments: { select: { status: true } },
    },
    orderBy: [{ startDate: "desc" }, { name: "asc" }],
  });

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
              A cohort is a <strong>label</strong>, not a permission — it groups learners taking a
              course together (e.g. &quot;March 2026 Batch&quot;) purely for reporting.
            </p>
            <p className="mt-2">
              This page rolls up every cohort across every course so you can see how each batch
              is doing without opening each course individually. Cohorts are created per course —
              see a course&apos;s &quot;Manage cohorts&quot; panel to add one.
            </p>
            <p className="mt-2">
              It does <strong>not</strong> restrict what a learner can see or who a facilitator
              can manage.
            </p>
          </InfoTooltip>
        </div>
        <p className="mt-1.5 max-w-2xl text-sm text-grey-700">
          Every batch across every course, in one place — status, who&apos;s running it, and how
          far along it is.
        </p>
      </div>

      {cohorts.length === 0 ? (
        <p className="text-sm text-grey-600">
          No cohorts yet — add one from a course&apos;s &quot;Manage cohorts&quot; panel under
          Admin → Courses.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-grey-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200 bg-grey-50 text-left text-xs font-semibold uppercase tracking-wide text-grey-600">
                <th className="px-5 py-3">Cohort</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Facilitator</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Enrolled</th>
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
                    <td className="px-5 py-3.5 font-medium text-ink">{cohort.name}</td>
                    <td className="px-4 py-3.5">
                      <Link href={`/admin/courses/${cohort.course.id}`} className="text-accent hover:underline">
                        {cohort.course.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant={status === "Active" ? "accent" : status === "Ended" ? "neutral" : "warning"}
                      >
                        {status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-grey-600">{cohort.facilitator?.name ?? "—"}</td>
                    <td className="px-4 py-3.5 text-grey-600">{range ?? "—"}</td>
                    <td className="px-4 py-3.5 text-grey-600">
                      {enrolledCount} enrolled, {completedCount} completed
                    </td>
                    <td className="w-40 px-4 py-3.5">
                      <ProgressBar percent={percent} />
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
