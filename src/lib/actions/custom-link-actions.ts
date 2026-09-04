"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { LinkPlacement } from "@/generated/prisma/client";

const schema = z.object({
  label: z.string().trim().min(1, "Label is required").max(40, "Keep the label short"),
  // httpUrl (not url) — these render as real <a href> tags site-wide, so a
  // javascript: URI here would be a stored XSS hitting every visitor who clicks it.
  url: z.httpUrl("Enter a full URL, e.g. https://example.org"),
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

  // max(order)+1, not count — count drifts from the actual ordering after any
  // add/delete/add cycle (delete the 2nd of 3 links and the next add reuses order 2,
  // colliding with the link already there instead of landing after it).
  const last = await prisma.customLink.findFirst({
    where: { organizationId: session.user.organizationId, placement },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await prisma.customLink.create({
    data: {
      organizationId: session.user.organizationId,
      placement,
      order: (last?.order ?? -1) + 1,
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
