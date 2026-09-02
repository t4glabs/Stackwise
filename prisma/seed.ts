import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { slugify } from "../src/lib/slugify";
import { bookstackIsConfigured } from "../src/lib/bookstack";
import { syncCourses } from "../src/lib/sync";

// Demo content mirrors the real books already on https://books.humansofwelive.org so the
// catalog looks right locally before a real BOOKSTACK_TOKEN_ID/SECRET is added. Once a
// token is set, re-running this script pulls the real catalog via syncCourses() instead
// and these placeholders are superseded (same organizationId+slug, so they get updated
// in place rather than duplicated where slugs happen to match).
const DEMO_COURSES = [
  {
    program: "Transition Program",
    title: "Course 1: Basic AI Course — Yuva AI for All",
    description:
      "A foundation course to build AI literacy for all learners, with hands-on practice with Generative AI tools.",
    type: "SELF_PACED" as const,
    durationLabel: "3 hours",
  },
  {
    program: "Transition Program",
    title: "Course 2: Basics of Excel Spreadsheet & Workbook",
    description: "A beginner-friendly course introducing spreadsheet and workbook skills.",
    type: "SELF_PACED" as const,
    durationLabel: "2 hours",
  },
  {
    program: "Transition Program",
    title: "Cyber Well-being",
    description: "Helps learners use the internet safely: privacy, strong passwords, and staying confident online.",
    type: "SELF_PACED" as const,
    durationLabel: "1.5 hours",
  },
  {
    program: "Transition Program",
    title: "Financial Well-being Workbook",
    description: "Practical knowledge to manage money and everyday responsibilities after leaving care.",
    type: "SELF_PACED" as const,
    durationLabel: "2 hours",
  },
  {
    program: "Transition Program",
    title: "Career Guidance & Work Readiness",
    description: "A guided workbook to explore career options and build practical education pathways.",
    type: "FACILITATED" as const,
    durationLabel: "4 sessions",
  },
  {
    program: null,
    title: "Spoken English",
    description: "Build confidence using English for everyday communication.",
    type: "SELF_PACED" as const,
    durationLabel: "3 hours",
  },
  {
    program: "Transition Program",
    title: "Digital Literacy Essentials",
    description: "A self-paced course hosted on Unithena — opens in a new tab.",
    type: "EXTERNAL_LINK" as const,
    durationLabel: "1 hour",
    externalUrl: "https://unithena.com/course/digital-literacy-essentials",
  },
];

const DEMO_LESSON_TITLES = ["Introduction", "Core Concepts", "Practice Exercise", "Wrap-up & Reflection"];

async function main() {
  const orgSlug = process.env.ORG_SLUG ?? "welive";
  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    create: {
      slug: orgSlug,
      name: process.env.ORG_NAME ?? "WeLive Foundation",
      bookstackBaseUrl: process.env.BOOKSTACK_BASE_URL ?? "https://books.humansofwelive.org",
    },
    update: {},
  });

  const admin = await upsertUser(org.id, "admin", "Admin", "ADMIN", "admin123");
  const facilitator = await upsertUser(org.id, "priya", "Priya (Facilitator)", "FACILITATOR", "facilitator123");
  const learner = await upsertUser(org.id, "arjun", "Arjun (Learner)", "LEARNER", "learner123");

  if (bookstackIsConfigured()) {
    console.log("BookStack token found — syncing the real catalog instead of demo data...");
    const result = await syncCourses(org);
    console.log(result);
  } else {
    console.log("No BookStack token set — seeding demo placeholder courses (see prisma/seed.ts).");
    let bookstackBookId = 9001;
    let bookstackPageId = 90001;

    for (const demo of DEMO_COURSES) {
      let programId: string | null = null;
      if (demo.program) {
        const program = await prisma.program.upsert({
          where: { organizationId_slug: { organizationId: org.id, slug: slugify(demo.program) } },
          create: { organizationId: org.id, name: demo.program, slug: slugify(demo.program) },
          update: {},
        });
        programId = program.id;
      }

      const slug = slugify(demo.title);
      const course = await prisma.course.upsert({
        where: { organizationId_slug: { organizationId: org.id, slug } },
        create: {
          organizationId: org.id,
          programId,
          bookstackBookId: bookstackBookId++,
          slug,
          title: demo.title,
          description: demo.description,
          type: demo.type,
          durationLabel: demo.durationLabel,
          externalUrl: "externalUrl" in demo ? demo.externalUrl : null,
          facilitatorEmail: null,
          published: true,
          lastSyncedAt: new Date(),
        },
        update: {},
      });

      if (demo.type !== "EXTERNAL_LINK") {
        for (const [i, title] of DEMO_LESSON_TITLES.entries()) {
          await prisma.lesson.upsert({
            where: { courseId_bookstackPageId: { courseId: course.id, bookstackPageId } },
            create: {
              courseId: course.id,
              bookstackPageId: bookstackPageId,
              title,
              slug: slugify(title),
              order: i,
            },
            update: {},
          });
          bookstackPageId++;
        }
      }

      if (demo.type === "FACILITATED") {
        await prisma.courseFacilitator.upsert({
          where: { courseId_facilitatorId: { courseId: course.id, facilitatorId: facilitator.id } },
          create: { courseId: course.id, facilitatorId: facilitator.id },
          update: {},
        });
      }
    }

    // Give the demo facilitator a self-paced course too, and enroll + progress the demo
    // learner in a couple of courses so the dashboard/facilitator views aren't empty.
    const aiCourse = await prisma.course.findFirst({ where: { organizationId: org.id, title: { contains: "Basic AI Course" } } });
    const cyberCourse = await prisma.course.findFirst({ where: { organizationId: org.id, title: "Cyber Well-being" } });
    const careerCourse = await prisma.course.findFirst({ where: { organizationId: org.id, title: "Career Guidance & Work Readiness" } });

    if (careerCourse) {
      await prisma.courseFacilitator.upsert({
        where: { courseId_facilitatorId: { courseId: careerCourse.id, facilitatorId: facilitator.id } },
        create: { courseId: careerCourse.id, facilitatorId: facilitator.id },
        update: {},
      });
    }

    for (const course of [aiCourse, cyberCourse, careerCourse].filter(Boolean)) {
      await prisma.enrollment.upsert({
        where: { learnerId_courseId: { learnerId: learner.id, courseId: course!.id } },
        create: { learnerId: learner.id, courseId: course!.id, source: "SELF" },
        update: {},
      });
    }

    if (aiCourse) {
      const lessons = await prisma.lesson.findMany({ where: { courseId: aiCourse.id }, orderBy: { order: "asc" } });
      for (const lesson of lessons.slice(0, 2)) {
        await prisma.progress.upsert({
          where: { learnerId_lessonId: { learnerId: learner.id, lessonId: lesson.id } },
          create: { learnerId: learner.id, lessonId: lesson.id, viewedAt: new Date(), completedAt: new Date() },
          update: {},
        });
      }
    }
  }

  console.log("\nSeeded. Demo logins (dev only — change before real use):");
  console.log(`  admin        / admin123        (${admin.username})`);
  console.log(`  facilitator  / facilitator123  (${facilitator.username})`);
  console.log(`  learner      / learner123      (${learner.username})`);
}

async function upsertUser(
  organizationId: string,
  username: string,
  name: string,
  role: "ADMIN" | "FACILITATOR" | "LEARNER",
  password: string
) {
  return prisma.user.upsert({
    where: { username },
    create: {
      organizationId,
      username,
      name,
      role,
      passwordHash: await hashPassword(password),
    },
    update: {},
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
