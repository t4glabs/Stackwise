import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/account/password");

  return (
    <Container className="flex max-w-sm flex-col gap-8 py-16">
      <div>
        <Eyebrow className="mb-1.5">Account</Eyebrow>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">Change password</h1>
      </div>
      <ChangePasswordForm />
    </Container>
  );
}
