import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/flags";

// Called wherever an enrollment gets marked COMPLETED (lesson-by-lesson auto-complete
// and the explicit "mark complete" action). Auto-issuance requires both the org-wide
// `certificates` flag and the course's own certificateEnabled toggle — see the schema
// comment on Course.certificateEnabled for why there are two gates. Safe to call
// repeatedly: upsert means re-completing a course never creates a duplicate.
export async function maybeIssueCertificate(learnerId: string, courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || !course.certificateEnabled) return;

  const flagOn = await isFeatureEnabled(course.organizationId, "certificates");
  if (!flagOn) return;

  await prisma.certificate.upsert({
    where: { learnerId_courseId: { learnerId, courseId } },
    create: { learnerId, courseId },
    update: {},
  });
}
