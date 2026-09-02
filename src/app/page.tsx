import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPrimaryOrganization } from "@/lib/org";
import { getFlags } from "@/lib/flags";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/course-card";

export default async function HomePage() {
  const org = await getPrimaryOrganization();
  const flags = await getFlags(org.id);

  const courses = await prisma.course.findMany({
    where: { organizationId: org.id, published: true },
    include: { program: true },
    orderBy: [{ order: "asc" }, { title: "asc" }],
    take: 3,
  });

  return (
    <div>
      <section className="border-b border-grey-200 bg-grey-50">
        <Container className="flex flex-col gap-5 py-20">
          <span className="text-xs font-bold uppercase tracking-widest text-grey-600">
            {org.name}
          </span>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-ink text-balance">
            Courses and transition programs, in one place.
          </h1>
          <p className="max-w-xl text-base text-grey-700">
            Every course here is written and maintained in our wiki. This is where you
            enroll, track progress, and pick up where you left off.
          </p>
          <div className="flex gap-3 pt-2">
            <Button size="lg" asChild>
              <Link href={flags.public_catalog ? "/courses" : "/login"}>
                Browse courses
              </Link>
            </Button>
          </div>
        </Container>
      </section>

      {courses.length > 0 ? (
        <section>
          <Container className="flex flex-col gap-6 py-14">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight text-ink">
                Featured courses
              </h2>
              <Link href="/courses" className="text-sm font-medium text-accent hover:underline">
                View all
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  slug={course.slug}
                  title={course.title}
                  description={course.description}
                  type={course.type}
                  durationLabel={course.durationLabel}
                  programName={course.program?.name}
                />
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </div>
  );
}
