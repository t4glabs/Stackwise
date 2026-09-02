"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { LinkPlacement } from "@/generated/prisma/client";

const schema = z.object({
  label: z.string().trim().min(1, "Label is required").max(40, "Keep the label short"),
  url: z.url("Enter a full URL, e.g. https://example.org"),
  openInNewTab: z.boolean(),
});

export type AddCustomLinkState = { ok: true } | { ok: false; error: string } | undefined;

export async function addCustomLink(
  placement: LinkPlacement,
  _prevState: AddCustomLinkState,
  formData: FormData
): Promise<AddCustomLinkState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false, error: "Only admins can change these links." };
  }

  const parsed = schema.safeParse({
    label: formData.get("label"),
    url: formData.get("url"),
    openInNewTab: formData.get("openInNewTab") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const count = await prisma.customLink.count({
    where: { organizationId: session.user.organizationId, placement },
  });

  await prisma.customLink.create({
    data: {
      organizationId: session.user.organizationId,
      placement,
      order: count,
      ...parsed.data,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCustomLink(linkId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can change these links.");
  }

  await prisma.customLink.deleteMany({
    where: { id: linkId, organizationId: session.user.organizationId },
  });

  revalidatePath("/", "layout");
}
