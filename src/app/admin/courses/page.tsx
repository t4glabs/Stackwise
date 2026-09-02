import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";

const TYPE_LABEL: Record<string, string> = {
  SELF_PACED: "Self-paced",
  FACILITATED: "Facilitated",
  EXTERNAL_LINK: "External link",
};

export default async function AdminCoursesPage() {
  const session = await auth();

  const courses = await prisma.course.findMany({
    where: { organizationId: session!.user.organizationId },
    include: { program: true, facilitators: { include: { facilitator: true } } },
    orderBy: [{ published: "desc" }, { title: "asc" }],
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <Eyebrow className="mb-1.5">{courses.length} from your wiki</Eyebrow>
        <p className="max-w-2xl text-sm text-grey-700">
          Every book from your wiki appears here automatically. Hidden ones aren&apos;t
          visible to learners until you turn them on below — no wiki editing required.
        </p>
      </div>

      {courses.length === 0 ? (
        <Card>
          <p className="text-sm text-grey-600">
            Nothing discovered yet. Connect BookStack and run a sync to see your books here.
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-card border border-grey-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200 bg-grey-50 text-left text-xs font-semibold uppercase tracking-wide text-grey-600">
                <th className="px-5 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Facilitators</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-b border-grey-200 last:border-0 hover:bg-grey-50/60">
                  <td className="px-5 py-3.5 font-medium text-ink">{course.title}</td>
                  <td className="px-4 py-3.5">
                    {course.published ? (
                      <Badge variant="success">Visible</Badge>
                    ) : (
                      <Badge variant="neutral">Hidden</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-grey-700">{TYPE_LABEL[course.type]}</td>
                  <td className="px-4 py-3.5 text-grey-700">{course.program?.name ?? "—"}</td>
                  <td className="px-4 py-3.5 text-grey-700">
                    {course.facilitators.length > 0
                      ? course.facilitators.map((f) => f.facilitator.name).join(", ")
                      : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/admin/courses/${course.id}`} className="font-medium text-accent hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
