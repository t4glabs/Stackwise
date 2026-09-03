"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getPrimaryOrganization } from "@/lib/org";
import { isFeatureEnabled } from "@/lib/flags";
import { generateUniqueUsername } from "@/lib/username";
import { createToken, appUrl } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { verifyEmailTemplate } from "@/lib/email-templates";

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

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return "That email is already registered — try logging in instead.";

  const username = await generateUniqueUsername(email);

  const user = await prisma.user.create({
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

  const token = await createToken(user.id, "EMAIL_VERIFY");
  const link = appUrl(`/verify-email?token=${token}`);
  const { subject, html, text } = verifyEmailTemplate(org.brandName, user.name, link);
  await sendEmail({ to: email, subject, html, text });

  redirect(`/register/check-email?email=${encodeURIComponent(email)}`);
}
