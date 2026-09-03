import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";
import { getPrimaryOrganization } from "@/lib/org";
import { logEvent } from "@/lib/log";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const userId = token ? await consumeToken(token, "EMAIL_VERIFY") : null;
  const org = await getPrimaryOrganization();
  if (userId) {
    const user = await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    await logEvent({
      organizationId: org.id,
      type: "VERIFY",
      level: "INFO",
      message: `Email verified for ${user.email ?? user.username}`,
      userId: user.id,
      email: user.email,
    });
  } else {
    await logEvent({
      organizationId: org.id,
      type: "VERIFY",
      level: "ERROR",
      message: "Invalid or expired verification link used",
    });
  }

  return (
    <Container className="flex min-h-[calc(100vh-77px)] max-w-sm flex-col justify-center gap-6 py-16 text-center">
      {userId ? (
        <>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] font-semibold tracking-tight text-ink">Email confirmed</h1>
            <p className="text-[15px] text-stone-600">Your account is active — you can log in now.</p>
          </div>
          <Button variant="accent" asChild className="self-center">
            <Link href="/login">Log in</Link>
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] font-semibold tracking-tight text-ink">Link expired or invalid</h1>
            <p className="text-[15px] text-stone-600">
              This confirmation link is no longer valid — it may have already been used or expired.
            </p>
          </div>
          <Link href="/resend-verification" className="text-sm font-medium text-accent hover:underline">
            Send a new link
          </Link>
        </>
      )}
    </Container>
  );
}
