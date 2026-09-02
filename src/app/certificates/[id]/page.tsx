import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrimaryOrganization } from "@/lib/org";
import { canManageCourseRoster } from "@/lib/people-permissions";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PrintButton } from "@/components/print-button";

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: { learner: true, course: true },
  });
  if (!certificate) notFound();

  const org = await getPrimaryOrganization();
  if (certificate.course.organizationId !== org.id) notFound();

  const isOwnCertificate = session.user.id === certificate.learnerId;
  const canManage = isOwnCertificate
    ? true
    : await canManageCourseRoster(session.user.id, session.user.role, certificate.courseId);
  if (!canManage) notFound();

  const issuedDate = certificate.issuedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Container className="flex flex-col items-center gap-8 py-16">
      <div
        id="certificate"
        className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-card border-2 border-accent/30 bg-white px-10 py-16 text-center shadow-sm"
      >
        <Eyebrow className="text-accent">Certificate of Completion</Eyebrow>
        <p className="font-serif text-lg text-stone-600">This certifies that</p>
        <h1 className="text-balance font-serif text-[40px] font-semibold leading-tight text-ink">
          {certificate.learner.name}
        </h1>
        <p className="max-w-lg text-balance font-serif text-lg text-stone-600">
          has successfully completed
        </p>
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-ink">
          {certificate.course.title}
        </h2>
        <div className="mt-4 flex flex-col items-center gap-1 border-t border-stone-200 pt-6">
          <p className="text-sm font-medium text-ink">{org.name}</p>
          <p className="text-sm text-stone-600">Issued {issuedDate}</p>
        </div>
      </div>

      <PrintButton />
    </Container>
  );
}
