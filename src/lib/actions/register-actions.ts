"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getPrimaryOrganization } from "@/lib/org";
import { isFeatureEnabled } from "@/lib/flags";
import { signIn } from "@/auth";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-z0-9._-]+$/, "Use only letters, numbers, dots, dashes, underscores"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function registerAction(_prevState: string | undefined, formData: FormData) {
  const org = await getPrimaryOrganization();

  const allowed = await isFeatureEnabled(org.id, "open_registration");
  if (!allowed) return "Self-registration is turned off — ask your facilitator for an account.";

  const parsed = schema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (existing) return "That username is already taken.";

  await prisma.user.create({
    data: {
      organizationId: org.id,
      role: "LEARNER",
      username: parsed.data.username,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  await signIn("credentials", {
    username: parsed.data.username,
    password: parsed.data.password,
    redirectTo: "/dashboard",
  });
}
