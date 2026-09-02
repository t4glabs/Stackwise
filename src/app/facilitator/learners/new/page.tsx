import { auth } from "@/auth";
import { getFlags } from "@/lib/flags";
import { Container } from "@/components/ui/container";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateUserForm } from "@/components/create-user-form";
import { createLearnerAction } from "@/lib/actions/user-actions";

export default async function NewLearnerPage() {
  const session = await auth();
  const flags = await getFlags(session!.user.organizationId);

  return (
    <Container className="flex max-w-md flex-col gap-6 py-12">
      <Card className="flex flex-col gap-6">
        <div>
          <CardTitle>Add a learner</CardTitle>
          <CardDescription>Creates a login they can use right away.</CardDescription>
        </div>
        <CreateUserForm
          action={createLearnerAction}
          personLabel="Learner"
          emailOptional={flags.learner_email_optional}
        />
      </Card>
    </Container>
  );
}
