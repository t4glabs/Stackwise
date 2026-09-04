import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/flags";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Card, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { FacilitatorCohortChecklist } from "@/components/facilitator-cohort-checklist";
import { ArrowLeft } from "lucide-react";

export default async function AdminFacilitatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const organizationId = session!.user.organizationId;

  const cohortsEnabled = await isFeatureEnabled(organizationId, "cohorts");
  if (!cohortsEnabled) notFound();

  const facilitator = await prisma.user.findFirst({
    where: { id, organizationId, role: "FACILITATOR" },
    include: {
      facilitatingCourses: { include: { course: { select: { id: true, title: true } } } },
      facilitatingCohorts: { select: { cohortId: true } },
    },
  });
  if (!facilitator) notFound();

  const cohorts = await prisma.cohort.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const linkedCohortIds = facilitator.facilitatingCohorts.map((c) => c.cohortId);

  return (
    <div className="flex min-w-0 max-w-2xl flex-col gap-6">
      <Link
        href="/admin/people?tab=facilitators"
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-grey-600 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> All facilitators
      </Link>

      <div>
        <Eyebrow className="mb-1.5">Facilitator</Eyebrow>
        <h2 className="text-xl font-semibold tracking-tight text-ink">{facilitator.name}</h2>
        <p className="mt-1 font-mono text-sm text-grey-600">{facilitator.email ?? facilitator.username}</p>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5">
          <CardTitle>Cohorts managed</CardTitle>
          <InfoTooltip label="What does this do?">
            <p>
              Scopes this facilitator to only these cohorts&apos; members — across whichever
              courses each cohort follows — instead of the courses they&apos;re directly assigned
              to below.
            </p>
            <p className="mt-2">
              A facilitator with no cohorts here behaves exactly as before: full access to
              whatever courses they&apos;re assigned to. The moment they&apos;re linked to even
              one cohort, that becomes their entire reach for people — no fallback to &quot;see
              everyone&quot;, even if this org doesn&apos;t otherwise require course assignment.
            </p>
          </InfoTooltip>
        </div>
        <p className="text-sm text-grey-700">
          Turning one on gives this facilitator access to exactly that cohort&apos;s members,
          wherever they&apos;re enrolled — nowhere else.
        </p>
        <FacilitatorCohortChecklist
          facilitatorId={facilitator.id}
          cohorts={cohorts}
          linkedCohortIds={linkedCohortIds}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Courses assigned directly</CardTitle>
        <p className="text-sm text-grey-700">
          Unrestricted access to these — read-only here, set from each course&apos;s own settings
          page.
        </p>
        {facilitator.facilitatingCourses.length === 0 ? (
          <p className="text-sm text-grey-600">Not directly assigned to any course.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {facilitator.facilitatingCourses.map((fc) => (
              <li key={fc.course.id}>
                <Link href={`/admin/courses/${fc.course.id}`} className="text-accent hover:underline">
                  {fc.course.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
