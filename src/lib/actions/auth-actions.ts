"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(_prevState: string | undefined, formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");

  try {
    await signIn("credentials", { username, password, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Incorrect username or password.";
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function redirectByRole(role: "LEARNER" | "FACILITATOR" | "ADMIN") {
  if (role === "ADMIN") redirect("/admin/flags");
  if (role === "FACILITATOR") redirect("/facilitator");
  redirect("/dashboard");
}
