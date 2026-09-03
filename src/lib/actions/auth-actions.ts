"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/admin",
  FACILITATOR: "/facilitator",
  LEARNER: "/dashboard",
};

export async function loginAction(_prevState: string | undefined, formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const explicitCallbackUrl = String(formData.get("callbackUrl") ?? "").trim();

  const account = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });

  // Check the password before saying anything about verification status — surfacing
  // "this account isn't verified yet" to someone who doesn't actually know the
  // password would leak whether an email is registered at all.
  if (account && !account.emailVerifiedAt) {
    const passwordOk = await verifyPassword(password, account.passwordHash);
    if (passwordOk) {
      return "Please verify your email before logging in — check your inbox for the link we sent when you signed up.";
    }
  }

  // Only /dashboard (the learner view) was ever used as the post-login destination,
  // which is why an admin logging in used to land on an empty "not enrolled in any
  // courses" screen. Route by the account's actual role unless the visit was
  // specifically redirected here from another page (e.g. hit a protected course URL).
  let redirectTo = explicitCallbackUrl;
  if (!redirectTo || redirectTo === "/dashboard") {
    redirectTo = (account && ROLE_HOME[account.role]) || "/dashboard";
  }

  try {
    await signIn("credentials", { identifier, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Incorrect email/username or password.";
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
