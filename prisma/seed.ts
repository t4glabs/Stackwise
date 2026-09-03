import "dotenv/config";
import { randomBytes } from "crypto";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { slugify } from "../src/lib/slugify";
import { bookstackIsConfigured } from "../src/lib/bookstack";
import { syncCourses } from "../src/lib/sync";
import { createToken, appUrl } from "../src/lib/tokens";
import { sendEmail, emailIsConfigured } from "../src/lib/email";
import { adminSetupTemplate } from "../src/lib/email-templates";
import { generateUniqueUsername } from "../src/lib/username";

// Placeholder courses so the catalog looks right locally before a real
// BOOKSTACK_TOKEN_ID/SECRET is added. Once a token is set, re-running this script pulls
// the real catalog via syncCourses() instead and these placeholders are superseded
// (same organizationId+slug, so they get updated in place rather than duplicated where
// slugs happen to match).
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
  const orgSlug = process.env.ORG_SLUG ?? "default";
  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    create: {
      slug: orgSlug,
      name: process.env.ORG_NAME ?? "Your Organization",
      bookstackBaseUrl: process.env.BOOKSTACK_BASE_URL ?? "https://wiki.your-org.org",
    },
    update: {},
  });

  // A configured BookStack connection is what distinguishes "someone is actually
  // deploying this for real" from "someone is poking at it locally before connecting
  // real content" (same signal DEPLOY.md's step order already relies on: BookStack is
  // set up in step 3, seeding happens in step 4). Demo accounts with fixed, publicly
  // visible passwords (this file is open source) are only ever created in the latter
  // case — a real deployment gets exactly one real admin, invited by email, and no
  // demo facilitator/learner accounts at all.
  if (bookstackIsConfigured()) {
    console.log("BookStack token found — syncing the real catalog (no demo data)...");
    const result = await syncCourses(org);
    console.log(result);
    await createRealAdmin(org.id, org.name);
  } else {
    console.log("No BookStack token set — treating this as a local/demo setup.");
    const admin = await upsertUser(org.id, "admin", "Admin", "ADMIN", "admin123");
    const facilitator = await upsertUser(org.id, "priya", "Priya (Facilitator)", "FACILITATOR", "facilitator123");
    const learner = await upsertUser(org.id, "arjun", "Arjun (Learner)", "LEARNER", "learner123");

    console.log("Seeding demo placeholder courses (see prisma/seed.ts)...");
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

    console.log("\nSeeded. Demo logins (local/demo only — never created once BookStack is configured):");
    console.log(`  admin        / admin123        (${admin.username})`);
    console.log(`  facilitator  / facilitator123  (${facilitator.username})`);
    console.log(`  learner      / learner123      (${learner.username})`);
  }
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
      // Local/demo accounts only reach this branch (see the comment above the
      // bookstackIsConfigured() check) — implicitly trusted, same as any other
      // staff-created account, so the email-verification gate in auth.ts doesn't
      // block them from logging in.
      emailVerifiedAt: new Date(),
    },
    update: {},
  });
}

// Real deployments get exactly one admin, created here and invited by email — never
// a fixed/guessable password. Requires ADMIN_EMAIL so there's no way to end up with a
// silently-unusable or silently-insecure admin account; DEPLOY.md documents this.
async function createRealAdmin(organizationId: string, orgName: string) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error(
      "BookStack is configured (this looks like a real deployment) but ADMIN_EMAIL is not set. " +
        "Add ADMIN_EMAIL (and optionally ADMIN_NAME) to .env and re-run `npm run db:seed` — see DEPLOY.md."
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} already exists — skipping (re-run doesn't re-invite an existing admin).`);
    return existing;
  }

  const name = process.env.ADMIN_NAME?.trim() || "Admin";
  const username = await generateUniqueUsername(email);

  const admin = await prisma.user.create({
    data: {
      organizationId,
      role: "ADMIN",
      username,
      name,
      email,
      // Nobody knows this — the account is unusable until the setup link below is
      // used, so there's never a default admin password to leave unrotated.
      passwordHash: await hashPassword(randomBytes(32).toString("hex")),
      emailVerifiedAt: new Date(),
    },
  });

  const token = await createToken(admin.id, "PASSWORD_RESET");
  const link = appUrl(`/reset-password?token=${token}`);
  const { subject, html, text } = adminSetupTemplate(orgName, name, link);
  await sendEmail({ to: email, subject, html, text, context: { organizationId, purpose: "Admin setup", userId: admin.id } });

  console.log(`\nAdmin account created for ${email}.`);
  console.log(
    emailIsConfigured()
      ? "A setup email was sent — they should check their inbox to set a password and log in."
      : "Mailgun isn't configured, so the setup link was printed above instead of emailed — copy it to finish setup."
  );

  return admin;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
