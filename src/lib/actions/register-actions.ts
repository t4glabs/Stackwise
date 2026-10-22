"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/password";
import { getPrimaryOrganization } from "@/lib/org";
import { isFeatureEnabled } from "@/lib/flags";
import { generateUniqueUsername } from "@/lib/username";
import { createToken, appUrl } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { verifyEmailTemplate } from "@/lib/email-templates";
import { logEvent } from "@/lib/log";
import { checkWindowedLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

// Bounds how many accounts one source can self-register in a window — this is the
// only one of the auth-adjacent actions where the abuse shape is "many different
// targets" (mass account creation) rather than "many attempts against one target", so
// it's IP-windowed rather than keyed by the (different, per-row) email each time.
// Admin bulk import (lib/bulk-import.ts) never calls this action — it creates users
// directly via its own prisma.user.create — so this limit has no effect on it.
// Set generously high rather than tight: this app's actual deployments are NGO
// programs where a whole classroom/computer-lab's worth of learners (20-30+) may
// self-register in one sitting from behind the same shared network address — a tight
// per-IP cap would misfire on exactly that normal, expected usage. This still fully
// closes off unattended automated mass-registration (hundreds/thousands of accounts).
const REGISTER_MAX_PER_WINDOW = 40;
const REGISTER_WINDOW_MS = 15 * 60 * 1000;

// Self-registration always requires a real email, regardless of the
// learner_email_optional flag — that flag is for staff-created accounts a human
// already vouches for; an anonymous self-signup with no verifiable email and no
// staff oversight is exactly the gap this whole flow closes. See lib/tokens.ts and
// the emailVerifiedAt comment on the User model.
const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function registerAction(_prevState: string | undefined, formData: FormData) {
  const org = await getPrimaryOrganization();

  const allowed = await isFeatureEnabled(org.id, "open_registration");
  if (!allowed) return "Self-registration is turned off — ask your facilitator for an account.";

  const clientIp = await getClientIp();
  if (!checkWindowedLimit(`register:${clientIp}`, REGISTER_MAX_PER_WINDOW, REGISTER_WINDOW_MS)) {
    return "Too many signups from this network right now — please try again later.";
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const email = parsed.data.email.trim().toLowerCase();

  // Redirects to the exact same "check your email" page regardless of whether the
  // email was already registered — telling a visitor "that email's already in use"
  // would let them enumerate registered addresses, the same anti-enumeration
  // reasoning as the generic-response pattern in password-reset-actions.ts and
  // resend-verification-actions.ts. A real duplicate-signup attempt is still fully
  // traceable via the logEvent call below, just not revealed to the caller.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await logEvent({
      organizationId: org.id,
      type: "REGISTER",
      level: "INFO",
      message: `Registration attempted for ${email} (already registered)`,
      email,
    });
    redirect(`/register/check-email?email=${encodeURIComponent(email)}`);
  }

  const username = await generateUniqueUsername(email);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        organizationId: org.id,
        role: "LEARNER",
        username,
        name: parsed.data.name,
        email,
        passwordHash: await hashPassword(parsed.data.password),
        emailVerifiedAt: null,
      },
    });
  } catch (err) {
    // Same email submitted twice at once (double-click, two tabs) races past the
    // findUnique check above — the unique constraint is the real guard either way,
    // and the same generic redirect applies here too.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      await logEvent({
        organizationId: org.id,
        type: "REGISTER",
        level: "INFO",
        message: `Registration attempted for ${email} (already registered, race)`,
        email,
      });
      redirect(`/register/check-email?email=${encodeURIComponent(email)}`);
    }
    throw err;
  }

  const token = await createToken(user.id, "EMAIL_VERIFY");
  const link = appUrl(`/verify-email?token=${token}`);
  const { subject, html, text } = verifyEmailTemplate(org.brandName, user.name, link);
  await sendEmail({
    to: email,
    subject,
    html,
    text,
    context: { organizationId: org.id, purpose: "Verification", userId: user.id },
  });
  await logEvent({
    organizationId: org.id,
    type: "REGISTER",
    level: "INFO",
    message: `New account registered: ${email}`,
    userId: user.id,
    email,
  });

  redirect(`/register/check-email?email=${encodeURIComponent(email)}`);
}
