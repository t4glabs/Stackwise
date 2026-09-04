import Link from "next/link";
import { Container } from "@/components/ui/container";
import { VerifyEmailForm } from "@/components/verify-email-form";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <Container className="flex min-h-[calc(100vh-77px)] max-w-sm flex-col items-center justify-center gap-6 py-16 text-center">
      {token ? (
        <VerifyEmailForm token={token} />
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
