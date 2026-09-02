"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isValidHexColor } from "@/lib/color";

const schema = z.object({
  name: z.string().trim().min(1, "Organization name is required"),
  brandName: z.string().trim().min(1, "Brand name is required"),
  accentColor: z.string().refine(isValidHexColor, "Enter a valid hex color, e.g. #7358b3"),
  heroHeading: z.string().trim().min(1, "Hero heading is required"),
  heroDescription: z.string().trim().min(1, "Hero description is required"),
  wikiLinkLabel: z.string().trim().min(1, "Wiki link label is required"),
});

export type SaveOrgSettingsState = { ok: true } | { ok: false; error: string } | undefined;

export async function saveOrgSettings(
  _prevState: SaveOrgSettingsState,
  formData: FormData
): Promise<SaveOrgSettingsState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false, error: "Only admins can change these settings." };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    brandName: formData.get("brandName"),
    accentColor: formData.get("accentColor"),
    heroHeading: formData.get("heroHeading"),
    heroDescription: formData.get("heroDescription"),
    wikiLinkLabel: formData.get("wikiLinkLabel"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: parsed.data,
  });

  // Every page (header, footer, home) reads these, so a blanket revalidate is simplest.
  revalidatePath("/", "layout");

  return { ok: true };
}
