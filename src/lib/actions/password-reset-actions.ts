"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getPrimaryOrganization } from "@/lib/org";
import { createToken, consumeToken, appUrl } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { passwordResetTemplate } from "@/lib/email-templates";
import { logEvent } from "@/lib/log";

const GENERIC_MESSAGE = "If an account exists for that email, we've sent a reset link.";

export type RequestResetState = { ok: true; message: string } | { ok: false; error: string } | undefined;

// Always the same response whether or not the email exists — telling an attacker
// "no account with that email" would let them enumerate registered addresses. Note
// this is only for the *success* path (ok: true) — an invalid-input error is a
// distinct case the form needs to render differently (and let the visitor retry).
export async function requestPasswordResetAction(
  _prevState: RequestResetState,
  formData: FormData
): Promise<RequestResetState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const parsed = z.email().safeParse(email);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };

  const org = await getPrimaryOrganization();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.organizationId === org.id) {
    const token = await createToken(user.id, "PASSWORD_RESET");
    const link = appUrl(`/reset-password?token=${token}`);
    const { subject, html, text } = passwordResetTemplate(org.brandName, user.name, link);
    await sendEmail({
      to: email,
      subject,
      html,
      text,
      context: { organizationId: org.id, purpose: "Password reset", userId: user.id },
    });
  } else {
    // Same reasoning as the resend-verification case — the response to the visitor
    // stays generic, but a mismatched email is exactly the kind of thing worth being
    // able to trace when someone says "I never got the reset link."
    await logEvent({
      organizationId: org.id,
      type: "PASSWORD_RESET",
      level: "INFO",
      message: `Password reset requested for ${email} (no matching account)`,
      email,
    });
  }

  return { ok: true, message: GENERIC_MESSAGE };
}

export type RedeemResetState = { ok: true } | { ok: false; error: string } | undefined;

export async function redeemPasswordResetAction(
  token: string,
  _prevState: RedeemResetState,
  formData: FormData
): Promise<RedeemResetState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const userId = await consumeToken(token, "PASSWORD_RESET");
  if (!userId) {
    const org = await getPrimaryOrganization();
    await logEvent({
      organizationId: org.id,
      type: "PASSWORD_RESET",
      level: "ERROR",
      message: "Invalid or expired password reset link used",
    });
    return { ok: false, error: "This reset link is invalid or has expired — request a new one." };
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });

  await logEvent({
    organizationId: user.organizationId,
    type: "PASSWORD_RESET",
    level: "INFO",
    message: `Password reset completed for ${user.email ?? user.username}`,
    userId: user.id,
    email: user.email,
  });

  return { ok: true };
}
