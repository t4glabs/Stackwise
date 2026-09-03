"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getPrimaryOrganization } from "@/lib/org";
import { createToken, consumeToken, appUrl } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { passwordResetTemplate } from "@/lib/email-templates";

const GENERIC_MESSAGE = "If an account exists for that email, we've sent a reset link.";

// Always the same response whether or not the email exists — telling an attacker
// "no account with that email" would let them enumerate registered addresses.
export async function requestPasswordResetAction(
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

  if (user && user.organizationId === org.id) {
    const token = await createToken(user.id, "PASSWORD_RESET");
    const link = appUrl(`/reset-password?token=${token}`);
    const { subject, html, text } = passwordResetTemplate(org.brandName, user.name, link);
    await sendEmail({ to: email, subject, html, text });
  }

  return GENERIC_MESSAGE;
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
    return { ok: false, error: "This reset link is invalid or has expired — request a new one." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });

  return { ok: true };
}
