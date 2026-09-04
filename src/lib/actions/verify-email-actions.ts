"use server";

import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";
import { getPrimaryOrganization } from "@/lib/org";
import { logEvent } from "@/lib/log";

export type ConfirmEmailState = { ok: true } | { ok: false; error: string } | undefined;

// A deliberate button-press, not a side effect of the page loading (see
// verify-email-form.tsx) — email security scanners (Outlook Safe Links, corporate
// gateways) commonly pre-fetch every link in an email, which would silently consume
// a single-use token before the real recipient ever clicks it.
export async function confirmEmailAction(
  token: string,
  _prevState: ConfirmEmailState
): Promise<ConfirmEmailState> {
  const org = await getPrimaryOrganization();
  const userId = await consumeToken(token, "EMAIL_VERIFY");

  if (!userId) {
    await logEvent({
      organizationId: org.id,
      type: "VERIFY",
      level: "ERROR",
      message: "Invalid or expired verification link used",
    });
    return { ok: false, error: "This link is invalid or has expired — request a new one." };
  }

  const user = await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await logEvent({
    organizationId: org.id,
    type: "VERIFY",
    level: "INFO",
    message: `Email verified for ${user.email ?? user.username}`,
    userId: user.id,
    email: user.email,
  });

  return { ok: true };
}
