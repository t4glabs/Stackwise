import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrimaryOrganization } from "@/lib/org";
import { getFlags } from "@/lib/flags";
import { Container } from "@/components/ui/container";
import { CourseCard } from "@/components/course-card";

export default async function CoursesPage() {
  const org = await getPrimaryOrganization();
  const flags = await getFlags(org.id);
  const session = await auth();

  if (!flags.public_catalog && !session) {
    redirect("/login?callbackUrl=/courses");
  }

  const courses = await prisma.course.findMany({
    where: { organizationId: org.id, published: true },
    include: { program: true },
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });

  const grouped = new Map<string, typeof courses>();
  for (const course of courses) {
    const key = course.program?.name ?? "General";
    grouped.set(key, [...(grouped.get(key) ?? []), course]);
  }

  return (
    <Container className="flex flex-col gap-10 py-14">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Courses</h1>
        <p className="mt-2 max-w-xl text-sm text-grey-700">
          Written and maintained in the WeLive wiki — this catalog updates automatically
          as courses are tagged and published there.
        </p>
      </div>

      {courses.length === 0 ? (
        <p className="text-sm text-grey-600">
          No courses are published yet. Tag a Book <code className="rounded bg-grey-100 px-1.5 py-0.5">lms_publish=true</code> in
          BookStack and it will show up here after the next sync.
        </p>
      ) : (
        [...grouped.entries()].map(([program, programCourses]) => (
          <section key={program} className="flex flex-col gap-5">
            <h2 className="text-lg font-semibold tracking-tight text-ink">{program}</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {programCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  slug={course.slug}
                  title={course.title}
                  description={course.description}
                  type={course.type}
                  durationLabel={course.durationLabel}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </Container>
  );
}
