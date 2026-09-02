"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { revalidatePath } from "next/cache";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-z0-9._-]+$/, "Use only letters, numbers, dots, dashes, underscores"),
});

function generateTempPassword() {
  // Short, readable, not security-critical — the learner changes it on first real use.
  // See DEPLOY.md / open question 3: many CCI youth have no personal email, so
  // facilitators hand this off directly rather than an emailed reset link.
  const words = ["river", "cedar", "maple", "coral", "amber", "quartz", "willow", "sable"];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(100 + Math.random() * 900);
  return `${word}${digits}`;
}

export type CreateLearnerState =
  | { ok: true; username: string; password: string }
  | { ok: false; error: string }
  | undefined;

export async function createLearnerAction(
  _prevState: CreateLearnerState,
  formData: FormData
): Promise<CreateLearnerState> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "FACILITATOR" && session.user.role !== "ADMIN")) {
    return { ok: false, error: "Only facilitators and admins can create learner accounts." };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (existing) return { ok: false, error: "That username is already taken." };

  const tempPassword = generateTempPassword();

  await prisma.user.create({
    data: {
      organizationId: session.user.organizationId,
      role: "LEARNER",
      username: parsed.data.username,
      name: parsed.data.name,
      passwordHash: await hashPassword(tempPassword),
      createdById: session.user.id,
    },
  });

  revalidatePath("/facilitator/learners/new");
  return { ok: true, username: parsed.data.username, password: tempPassword };
}
