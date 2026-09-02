import { Container } from "@/components/ui/container";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateLearnerForm } from "@/components/create-learner-form";

export default function NewLearnerPage() {
  return (
    <Container className="flex max-w-md flex-col gap-6 py-14">
      <Card className="flex flex-col gap-6">
        <div>
          <CardTitle>Add a learner</CardTitle>
          <CardDescription>
            Creates a login for a learner without needing their own email address.
          </CardDescription>
        </div>
        <CreateLearnerForm />
      </Card>
    </Container>
  );
}
