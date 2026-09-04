import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncCourses } from "@/lib/sync";
import { getPrimaryOrganization } from "@/lib/org";
import { logEvent } from "@/lib/log";

// timingSafeEqual throws on a length mismatch rather than just returning false, so the
// length check has to happen first — but comparing lengths (or short-circuiting on a
// missing secret) leaks no more than a network observer could already infer from
// this being a fixed-length shared secret in the first place.
function secretMatches(provided: string | null, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Shared by the BookStack webhook receiver and the manual/cron sync route. Configure
// the webhook in BookStack (Settings > Webhooks) to POST to
// https://<domain>/api/webhooks/bookstack?secret=<BOOKSTACK_WEBHOOK_SECRET>
// on book/chapter/page create/update/delete events.
export async function handleSyncRequest(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!secretMatches(secret, process.env.BOOKSTACK_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const org = await getPrimaryOrganization();
  try {
    const result = await syncCourses(org);
    return NextResponse.json(result);
  } catch (error) {
    // Only failures are logged here (not every routine sync) — a successful sync
    // isn't something an admin needs a trail of, but "the lesson looks stuck/missing"
    // usually traces back to a sync that quietly started failing.
    await logEvent({
      organizationId: org.id,
      type: "SYNC",
      level: "ERROR",
      message: "Content sync failed",
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
