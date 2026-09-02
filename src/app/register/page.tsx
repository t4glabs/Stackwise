import { redirect } from "next/navigation";
import { getPrimaryOrganization } from "@/lib/org";
import { getFlags } from "@/lib/flags";
import { Container } from "@/components/ui/container";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { RegisterForm } from "@/components/register-form";

export default async function RegisterPage() {
  const org = await getPrimaryOrganization();
  const flags = await getFlags(org.id);
  if (!flags.open_registration) redirect("/login");

  return (
    <Container className="flex max-w-sm flex-col gap-6 py-20">
      <Card className="flex flex-col gap-6">
        <div>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Start learning right away.</CardDescription>
        </div>
        <RegisterForm />
      </Card>
    </Container>
  );
}
