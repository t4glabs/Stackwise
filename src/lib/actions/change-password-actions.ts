"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

export type ChangePasswordState = { ok: true } | { ok: false; error: string } | undefined;

// The logged-in-and-knows-their-current-password path — no email involved, unlike
// forgot-password (lib/actions/password-reset-actions.ts), which is for someone who's
// locked out entirely.
export async function changeOwnPasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (newPassword.length < 6) {
    return { ok: false, error: "New password must be at least 6 characters." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { ok: false, error: "Account not found." };

  const currentOk = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentOk) return { ok: false, error: "Current password is incorrect." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return { ok: true };
}
