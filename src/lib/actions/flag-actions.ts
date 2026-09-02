"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { setFlag, type FeatureFlagKey } from "@/lib/flags";

export async function toggleFlagAction(key: FeatureFlagKey, enabled: boolean) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can change feature flags.");
  }

  await setFlag(session.user.organizationId, key, enabled);
  revalidatePath("/admin/flags");
}
