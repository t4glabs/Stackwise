"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const LIMITS = {
  logo: {
    maxBytes: 2 * 1024 * 1024,
    allowed: ["image/png", "image/jpeg", "image/svg+xml", "image/webp"],
  },
  favicon: {
    maxBytes: 512 * 1024,
    allowed: ["image/png", "image/x-icon", "image/vnd.microsoft.icon"],
  },
} as const;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

export type UploadBrandImageState =
  | { ok: true; url: string }
  | { ok: false; error: string }
  | undefined;

export async function uploadBrandImage(
  kind: "logo" | "favicon",
  _prevState: UploadBrandImageState,
  formData: FormData
): Promise<UploadBrandImageState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false, error: "Only admins can change branding." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image first." };
  }

  const limits = LIMITS[kind];
  if (!limits.allowed.includes(file.type as never)) {
    return { ok: false, error: `That file type isn't supported for a ${kind}.` };
  }
  if (file.size > limits.maxBytes) {
    return { ok: false, error: `Keep it under ${Math.round(limits.maxBytes / 1024)}KB.` };
  }

  const ext = EXT_BY_MIME[file.type] ?? "bin";
  const filename = `${kind}-${session.user.organizationId}-${Date.now()}.${ext}`;
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, filename), Buffer.from(await file.arrayBuffer()));

  const url = `/uploads/${filename}`;
  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: kind === "logo" ? { logoUrl: url } : { faviconUrl: url },
  });

  revalidatePath("/", "layout");
  return { ok: true, url };
}

export async function removeBrandImage(kind: "logo" | "favicon") {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can change branding.");
  }

  // Leaves the file on disk (uploads are small and infrequent — not worth the
  // complexity of tracking/cleaning up orphaned files for this).
  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: kind === "logo" ? { logoUrl: null } : { faviconUrl: null },
  });

  revalidatePath("/", "layout");
}
