import { Container } from "@/components/ui/container";
import { ResendVerificationForm } from "@/components/resend-verification-form";

export default function ResendVerificationPage() {
  return (
    <Container className="flex min-h-[calc(100vh-77px)] max-w-sm flex-col justify-center gap-8 py-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Resend confirmation link</h1>
        <p className="text-[15px] text-stone-600">Enter the email you signed up with.</p>
      </div>
      <div className="rounded-card border border-stone-200 bg-white p-7">
        <ResendVerificationForm />
      </div>
    </Container>
  );
}
