import Link from "next/link";
import { Container } from "@/components/ui/container";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <Container className="flex min-h-[calc(100vh-77px)] max-w-sm flex-col justify-center gap-6 py-16 text-center">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Check your email</h1>
        <p className="text-[15px] text-stone-600">
          {email ? (
            <>
              We sent a link to <span className="font-medium text-ink">{email}</span> to confirm your
              account.
            </>
          ) : (
            "We sent you a link to confirm your account."
          )}{" "}
          Click it to finish signing up.
        </p>
      </div>
      <p className="text-sm text-stone-600">
        Didn&apos;t get it?{" "}
        <Link href="/resend-verification" className="font-medium text-accent hover:underline">
          Resend the link
        </Link>
      </p>
    </Container>
  );
}
