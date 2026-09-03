"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { generateTempPassword } from "@/lib/temp-password";
import { generateUniqueUsername } from "@/lib/username";
import { isFeatureEnabled } from "@/lib/flags";
import { getPrimaryOrganization } from "@/lib/org";
import { sendEmail } from "@/lib/email";
import { credentialsTemplate } from "@/lib/email-templates";
import { revalidatePath } from "next/cache";
import type { Role } from "@/generated/prisma/client";

const nameSchema = z.string().trim().min(1, "Name is required");
const emailSchema = z.email("That doesn't look like a valid email address");
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .regex(/^[a-z0-9._-]+$/, "Use only letters, numbers, dots, dashes, underscores");

export type CreateUserState =
  | { ok: true; id: string; identifier: string; password: string }
  | { ok: false; error: string }
  | undefined;

// Exported so course-roster-actions.ts can reuse the exact same validation/creation
// logic for the "create a new learner and enroll them" flow — one registry, one path
// to get into it, whether or not a course enrollment happens alongside it.
export async function createUser(
  role: Role,
  formData: FormData,
  emailOptional: boolean
): Promise<CreateUserState> {
  const nameResult = nameSchema.safeParse(formData.get("name"));
  if (!nameResult.success) {
    return { ok: false, error: nameResult.error.issues[0]?.message ?? "Invalid name." };
  }
  const name = nameResult.data;

  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const session = await auth();
  let email: string | null = null;
  let username: string;

  if (emailRaw) {
    const emailResult = emailSchema.safeParse(emailRaw);
    if (!emailResult.success) {
      return { ok: false, error: emailResult.error.issues[0]?.message ?? "Invalid email." };
    }
    const existingByEmail = await prisma.user.findUnique({ where: { email: emailResult.data } });
    if (existingByEmail) return { ok: false, error: "That email is already in use." };

    email = emailResult.data;
    username = await generateUniqueUsername(email);
  } else {
    if (!emailOptional) {
      return { ok: false, error: "Email is required." };
    }
    const usernameResult = usernameSchema.safeParse(formData.get("username"));
    if (!usernameResult.success) {
      return { ok: false, error: usernameResult.error.issues[0]?.message ?? "Invalid username." };
    }
    const existingByUsername = await prisma.user.findUnique({ where: { username: usernameResult.data } });
    if (existingByUsername) return { ok: false, error: "That username is already taken." };
    username = usernameResult.data;
  }

  const tempPassword = generateTempPassword();

  const created = await prisma.user.create({
    data: {
      organizationId: session!.user.organizationId,
      role,
      username,
      email,
      name,
      passwordHash: await hashPassword(tempPassword),
      createdById: session!.user.id,
      // Staff-created accounts are implicitly trusted — a human already vouches for
      // this person, unlike the anonymous self-registration path (see registerAction),
      // which is the only place emailVerifiedAt actually starts out null.
      emailVerifiedAt: new Date(),
    },
  });

  // Opt-in, staff-facing checkbox — see CreateUserForm. Only meaningful when the
  // account actually has an email; a username-only account has nowhere to send it.
  if (email && formData.get("sendCredentialsEmail") === "on") {
    const org = await getPrimaryOrganization();
    const { subject, html, text } = credentialsTemplate(org.brandName, name, email, tempPassword);
    // Best-effort: the account is already created and its password is shown
    // on-screen regardless, so a failed send here shouldn't fail account creation —
    // sendEmail logs the outcome either way (see lib/email.ts).
    await sendEmail({
      to: email,
      subject,
      html,
      text,
      context: { organizationId: org.id, purpose: "Login details", userId: created.id },
    });
  }

  return { ok: true, id: created.id, identifier: email ?? username, password: tempPassword };
}

export async function createLearnerAction(
  _prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "FACILITATOR" && session.user.role !== "ADMIN")) {
    return { ok: false, error: "Only facilitators and admins can create learner accounts." };
  }

  const emailOptional = await isFeatureEnabled(session.user.organizationId, "learner_email_optional");
  const result = await createUser("LEARNER", formData, emailOptional);
  revalidatePath("/facilitator/learners/new");
  revalidatePath("/admin/people");
  return result;
}

export async function createFacilitatorAction(
  _prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false, error: "Only admins can create facilitator accounts." };
  }

  const emailOptional = await isFeatureEnabled(session.user.organizationId, "facilitator_email_optional");
  const result = await createUser("FACILITATOR", formData, emailOptional);
  revalidatePath("/admin/people");
  return result;
}

export type ResetPasswordState =
  | { ok: true; identifier: string; password: string }
  | { ok: false; error: string }
  | undefined;

export async function resetPasswordAction(
  targetUserId: string,
  _prevState: ResetPasswordState
): Promise<ResetPasswordState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.organizationId !== session.user.organizationId) {
    return { ok: false, error: "Account not found." };
  }

  const isAdmin = session.user.role === "ADMIN";
  const isFacilitatorResettingLearner = session.user.role === "FACILITATOR" && target.role === "LEARNER";
  if (!isAdmin && !isFacilitatorResettingLearner) {
    return { ok: false, error: "You don't have permission to reset this password." };
  }

  const tempPassword = generateTempPassword();
  await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash: await hashPassword(tempPassword) },
  });

  revalidatePath("/admin/people");
  revalidatePath("/facilitator");
  return { ok: true, identifier: target.email ?? target.username, password: tempPassword };
}
