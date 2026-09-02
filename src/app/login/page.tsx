import Link from "next/link";
import { getPrimaryOrganization } from "@/lib/org";
import { getFlags } from "@/lib/flags";
import { Container } from "@/components/ui/container";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const org = await getPrimaryOrganization();
  const flags = await getFlags(org.id);

  return (
    <Container className="flex min-h-[calc(100vh-77px)] max-w-sm flex-col justify-center gap-8 py-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Log in</h1>
        <p className="text-[15px] text-stone-600">Continue to your courses.</p>
      </div>

      <div className="rounded-card border border-stone-200 bg-white p-7">
        <LoginForm callbackUrl={callbackUrl ?? ""} />
      </div>

      {flags.open_registration ? (
        <p className="text-center text-[14px] text-stone-600">
          New here?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </p>
      ) : (
        <p className="text-center text-[14px] text-stone-600">
          Don&apos;t have an account? Ask your facilitator to set one up for you.
        </p>
      )}
    </Container>
  );
}
