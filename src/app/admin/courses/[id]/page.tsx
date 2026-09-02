import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFlags } from "@/lib/flags";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Badge } from "@/components/ui/badge";
import { CourseConfigForm } from "@/components/course-config-form";
import { EnrollLearnerPanel } from "@/components/enroll-learner-panel";
import { ArrowLeft } from "lucide-react";

export default async function AdminCourseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const course = await prisma.course.findFirst({
    where: { id, organizationId: session!.user.organizationId },
    include: {
      program: true,
      facilitators: true,
      enrollments: { include: { learner: true }, orderBy: { enrolledAt: "desc" } },
    },
  });
  if (!course) notFound();

  const [programs, facilitators, flags] = await Promise.all([
    prisma.program.findMany({
      where: { organizationId: session!.user.organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: session!.user.organizationId, role: "FACILITATOR" },
      orderBy: { name: "asc" },
    }),
    getFlags(session!.user.organizationId),
  ]);

  const coursePath = `/admin/courses/${course.id}`;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Link
        href="/admin/courses"
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-grey-600 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> All courses
      </Link>

      <div>
        <Eyebrow className="mb-1.5">From your wiki</Eyebrow>
        <h2 className="text-xl font-semibold tracking-tight text-ink">{course.title}</h2>
        {course.description ? (
          <p className="mt-1 text-sm text-grey-600">{course.description}</p>
        ) : null}
      </div>

      <CourseConfigForm
        courseId={course.id}
        published={course.published}
        type={course.type}
        programName={course.program?.name ?? ""}
        durationLabel={course.durationLabel ?? ""}
        externalUrl={course.externalUrl ?? ""}
        downloadableWorkbook={course.downloadableWorkbook}
        assignedFacilitatorIds={course.facilitators.map((f) => f.facilitatorId)}
        allPrograms={programs.map((p) => p.name)}
        allFacilitators={facilitators.map((f) => ({ id: f.id, name: f.name }))}
      />

      <div className="flex flex-col gap-3 border-t border-grey-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>Enrolled learners ({course.enrollments.length})</Eyebrow>
          <EnrollLearnerPanel
            courseId={course.id}
            coursePath={coursePath}
            emailOptional={flags.learner_email_optional}
          />
        </div>

        {course.enrollments.length === 0 ? (
          <p className="text-sm text-grey-600">No one enrolled yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-grey-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-200 bg-grey-50 text-left text-xs font-semibold uppercase tracking-wide text-grey-600">
                  <th className="px-5 py-2.5">Learner</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Source</th>
                </tr>
              </thead>
              <tbody>
                {course.enrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="border-b border-grey-200 last:border-0">
                    <td className="px-5 py-3 text-ink">{enrollment.learner.name}</td>
                    <td className="px-4 py-3">
                      {enrollment.status === "COMPLETED" ? (
                        <Badge variant="success">Completed</Badge>
                      ) : (
                        <Badge variant="accent">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-grey-600">
                      {enrollment.source === "SELF" ? "Self-enrolled" : "Assigned"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
