"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getPrimaryOrganization } from "@/lib/org";
import { syncCourses } from "@/lib/sync";

export type SyncNowState =
  | { ok: true; booksScanned: number; newlyDiscovered: number; hidden: number }
  | { ok: false; error: string }
  | undefined;

// The webhook + cron backstop (see /api/sync) keep the catalog fresh automatically,
// but an admin who just edited the wiki shouldn't have to wait for the next poll —
// this runs the same syncCourses() an admin session can already trigger, no webhook
// secret involved.
export async function syncNowAction(): Promise<SyncNowState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false, error: "Only admins can sync." };
  }

  const org = await getPrimaryOrganization();
  if (!org.bookstackBaseUrl) {
    return { ok: false, error: "BookStack isn't connected yet — see DEPLOY.md." };
  }

  const result = await syncCourses(org);
  if (!result.configured) {
    return { ok: false, error: "BookStack API token isn't set in .env." };
  }

  revalidatePath("/admin/courses");
  revalidatePath("/admin");
  revalidatePath("/courses");

  return {
    ok: true,
    booksScanned: result.booksScanned,
    newlyDiscovered: result.newlyDiscovered,
    hidden: result.hidden,
  };
}
