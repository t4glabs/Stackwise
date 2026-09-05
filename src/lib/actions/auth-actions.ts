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

// callbackUrl comes from the login page's own URL query string (proxy.ts sets it to
// a same-origin pathname when redirecting to /login, but nothing stops someone from
// sharing a link with a different value in it) — redirecting straight to whatever a
// visitor's URL happens to contain is an open-redirect: a link like
// /login?callbackUrl=https://evil.example would send someone to an attacker's site
// immediately after they type in their real password. Only ever follow it if it's a
// same-origin path.
function isSafeRedirect(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

export async function loginAction(_prevState: string | undefined, formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const explicitCallbackUrl = String(formData.get("callbackUrl") ?? "").trim();

  const account = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });

  // Check the password before saying anything about verification/disabled status —
  // surfacing account state to someone who doesn't actually know the password would
  // leak whether an email is registered at all.
  if (account && !account.emailVerifiedAt) {
    const passwordOk = await verifyPassword(password, account.passwordHash);
    if (passwordOk) {
      return "Please verify your email before logging in — check your inbox for the link we sent when you signed up.";
    }
  }
  if (account && account.disabledAt) {
    const passwordOk = await verifyPassword(password, account.passwordHash);
    if (passwordOk) {
      return "This account has been deactivated. Contact an admin if this isn't right.";
    }
  }

  // Only /dashboard (the learner view) was ever used as the post-login destination,
  // which is why an admin logging in used to land on an empty "not enrolled in any
  // courses" screen. Route by the account's actual role unless the visit was
  // specifically redirected here from another page (e.g. hit a protected course URL).
  let redirectTo = explicitCallbackUrl;
  if (!redirectTo || redirectTo === "/dashboard" || !isSafeRedirect(redirectTo)) {
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
