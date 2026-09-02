import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPrimaryOrganization } from "@/lib/org";
import { getFlags } from "@/lib/flags";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { CourseCard, CourseGrid } from "@/components/course-card";

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
      <section>
        <Container className="flex flex-col gap-6 py-24">
          <Eyebrow>{org.name}</Eyebrow>
          <h1 className="max-w-2xl text-balance text-[48px] font-semibold leading-[1.05] tracking-[-0.01em] text-ink sm:text-[52px]">
            {org.heroHeading}
          </h1>
          <p className="max-w-lg font-serif text-[17px] leading-relaxed text-stone-600">
            {org.heroDescription}
          </p>
          <div className="pt-2">
            <Button variant="accent" size="lg" asChild>
              <Link href={flags.public_catalog ? "/courses" : "/login"}>
                Browse courses
              </Link>
            </Button>
          </div>
        </Container>
      </section>

      {courses.length > 0 ? (
        <section className="border-t border-stone-200">
          <Container className="flex flex-col gap-8 py-16">
            <div className="flex items-end justify-between gap-4">
              <div>
                <Eyebrow className="mb-2">On the catalog</Eyebrow>
                <h2 className="text-[22px] font-semibold tracking-tight text-ink">
                  Featured courses
                </h2>
              </div>
              <Link
                href="/courses"
                className="shrink-0 text-[14px] font-medium text-accent hover:underline"
              >
                View all →
              </Link>
            </div>
            <CourseGrid>
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
            </CourseGrid>
          </Container>
        </section>
      ) : null}
    </div>
  );
}
