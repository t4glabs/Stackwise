import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <Container className="flex min-h-[calc(100vh-77px)] max-w-sm flex-col justify-center gap-8 py-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Set a new password</h1>
      </div>
      <div className="rounded-card border border-stone-200 bg-white p-7">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-sm text-danger">
            Missing reset link — go back to{" "}
            <Link href="/forgot-password" className="font-medium text-accent hover:underline">
              request a new one
            </Link>
            .
          </p>
        )}
      </div>
    </Container>
  );
}
