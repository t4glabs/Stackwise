"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPrimaryOrganization } from "@/lib/org";
import { createToken, appUrl } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { verifyEmailTemplate } from "@/lib/email-templates";
import { logEvent } from "@/lib/log";

const GENERIC_MESSAGE = "If that email needs verifying, we've sent a new link.";

// Always returns the same message regardless of whether the email exists or is
// already verified — same anti-enumeration reasoning as the password-reset request
// (see password-reset-actions.ts).
export async function resendVerificationAction(
  _prevState: string | undefined,
  formData: FormData
): Promise<string> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const parsed = z.email().safeParse(email);
  if (!parsed.success) return "Enter a valid email address.";

  const org = await getPrimaryOrganization();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.emailVerifiedAt && user.organizationId === org.id) {
    const token = await createToken(user.id, "EMAIL_VERIFY");
    const link = appUrl(`/verify-email?token=${token}`);
    const { subject, html, text } = verifyEmailTemplate(org.brandName, user.name, link);
    await sendEmail({
      to: email,
      subject,
      html,
      text,
      context: { organizationId: org.id, purpose: "Verification (resend)", userId: user.id },
    });
  } else {
    // Someone requested a resend for an email that's already verified, doesn't
    // exist, or belongs to a different org — worth a trace even though the
    // response back to them is deliberately identical either way.
    await logEvent({
      organizationId: org.id,
      type: "VERIFY",
      level: "INFO",
      message: `Verification resend requested for ${email} (no unverified account matched)`,
      email,
    });
  }

  return GENERIC_MESSAGE;
}
