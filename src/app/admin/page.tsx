import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { bookstackIsConfigured } from "@/lib/bookstack";

export default async function AdminOverviewPage() {
  const session = await auth();
  const organizationId = session!.user.organizationId;

  const [learners, facilitators, publishedCourses, awaitingReview, enrollments, completions] =
    await Promise.all([
      prisma.user.count({ where: { organizationId, role: "LEARNER" } }),
      prisma.user.count({ where: { organizationId, role: "FACILITATOR" } }),
      prisma.course.count({ where: { organizationId, published: true } }),
      prisma.course.count({ where: { organizationId, published: false } }),
      prisma.enrollment.count({ where: { course: { organizationId } } }),
      prisma.enrollment.count({ where: { course: { organizationId }, status: "COMPLETED" } }),
    ]);

  const stats = [
    { label: "Learners", value: learners, href: "/admin/people" },
    { label: "Facilitators", value: facilitators, href: "/admin/people" },
    { label: "Published courses", value: publishedCourses, href: "/admin/courses" },
    { label: "Enrollments", value: enrollments, href: null },
    { label: "Completions", value: completions, href: null },
  ];

  return (
    <div className="flex flex-col gap-8">
      {!bookstackIsConfigured() ? (
        <Card className="border-warning/30 bg-warning-soft">
          <p className="text-sm font-medium text-ink">BookStack isn&apos;t connected yet.</p>
          <p className="mt-1 text-sm text-grey-700">
            Add BOOKSTACK_TOKEN_ID / BOOKSTACK_TOKEN_SECRET to .env, then re-run the sync.
          </p>
        </Card>
      ) : awaitingReview > 0 ? (
        <Card className="flex items-center justify-between gap-4 border-accent/30 bg-accent-soft">
          <div>
            <p className="text-sm font-medium text-ink">
              {awaitingReview} book{awaitingReview === 1 ? "" : "s"} from your wiki {awaitingReview === 1 ? "hasn't" : "haven't"} been reviewed yet.
            </p>
            <p className="mt-1 text-sm text-grey-700">
              They&apos;re hidden from learners until you turn them into courses.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/courses">Review now</Link>
          </Button>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <Eyebrow>At a glance</Eyebrow>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((stat) => {
            const inner = (
              <Card className="flex flex-col gap-1">
                <span className="text-[32px] font-semibold tabular-nums tracking-tight text-ink">
                  {stat.value}
                </span>
                <span className="text-sm text-grey-600">{stat.label}</span>
              </Card>
            );
            return stat.href ? (
              <Link key={stat.label} href={stat.href}>
                {inner}
              </Link>
            ) : (
              <div key={stat.label}>{inner}</div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Eyebrow>Quick actions</Eyebrow>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="flex flex-col gap-3">
            <CardTitle>Set up a course</CardTitle>
            <p className="text-sm text-grey-700">
              Everything from your wiki shows up here automatically. Choose what&apos;s visible,
              set the duration, and assign a facilitator — all in plain language.
            </p>
            <Button asChild variant="outline" className="self-start">
              <Link href="/admin/courses">Go to Courses</Link>
            </Button>
          </Card>
          <Card className="flex flex-col gap-3">
            <CardTitle>Add people</CardTitle>
            <p className="text-sm text-grey-700">
              Create facilitator accounts, add learners who don&apos;t have their own email,
              or reset a forgotten password.
            </p>
            <Button asChild variant="outline" className="self-start">
              <Link href="/admin/people">Go to People</Link>
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
