import Link from "next/link";
import { getPrimaryOrganization } from "@/lib/org";
import { getFlags } from "@/lib/flags";
import { Container } from "@/components/ui/container";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
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
    <Container className="flex max-w-sm flex-col gap-6 py-20">
      <Card className="flex flex-col gap-6">
        <div>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Continue to your courses.</CardDescription>
        </div>
        <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} />
      </Card>
      {flags.open_registration ? (
        <p className="text-center text-sm text-grey-600">
          New here?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </p>
      ) : (
        <p className="text-center text-sm text-grey-600">
          Don&apos;t have an account? Ask your facilitator to set one up for you.
        </p>
      )}
    </Container>
  );
}
