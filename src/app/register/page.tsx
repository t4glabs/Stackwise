import { redirect } from "next/navigation";
import { getPrimaryOrganization } from "@/lib/org";
import { getFlags } from "@/lib/flags";
import { Container } from "@/components/ui/container";
import { RegisterForm } from "@/components/register-form";

export default async function RegisterPage() {
  const org = await getPrimaryOrganization();
  const flags = await getFlags(org.id);
  if (!flags.open_registration) redirect("/login");

  return (
    <Container className="flex min-h-[calc(100vh-77px)] max-w-sm flex-col justify-center gap-8 py-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Create an account</h1>
        <p className="text-[15px] text-stone-600">Start learning right away.</p>
      </div>

      <div className="rounded-card border border-stone-200 bg-white p-7">
        <RegisterForm />
      </div>
    </Container>
  );
}
