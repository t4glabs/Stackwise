import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrimaryOrganization } from "@/lib/org";
import { getFlags } from "@/lib/flags";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { CourseCard, CourseGrid } from "@/components/course-card";

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
    <Container className="flex flex-col gap-14 py-16">
      <div className="flex flex-col gap-3">
        <Eyebrow>Catalog</Eyebrow>
        <h1 className="text-[36px] font-semibold tracking-[-0.01em] text-ink">Courses</h1>
        <p className="max-w-lg font-serif text-[16px] leading-relaxed text-stone-600">
          Written and maintained in the WeLive wiki — this catalog updates automatically
          as courses are set up there.
        </p>
      </div>

      {courses.length === 0 ? (
        <p className="max-w-md text-[15px] text-stone-600">
          No courses are published yet. An admin can turn one on from{" "}
          <span className="font-medium text-ink">Admin → Courses</span> once it&apos;s ready.
        </p>
      ) : (
        [...grouped.entries()].map(([program, programCourses]) => (
          <section key={program} className="flex flex-col gap-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.13em] text-stone-600">
              {program}
            </h2>
            <CourseGrid>
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
            </CourseGrid>
          </section>
        ))
      )}
    </Container>
  );
}
