import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncCourses } from "@/lib/sync";
import { getPrimaryOrganization } from "@/lib/org";
import { logEvent } from "@/lib/log";
import { tryConsumeCooldown } from "@/lib/rate-limit";

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

// A single org's sync is cheap to trigger but not cheap to run (a full serial walk of
// every book and chapter — see syncCourses) — this bounds how often it can actually
// execute regardless of how many requests arrive, so a leaked secret (or just a
// misbehaving webhook retrying aggressively) can't turn into unbounded BookStack API
// load or DB writes. Deliberately short: real content changes are still picked up by
// the very next request once the cooldown clears, and the 20-minute cron backstop
// (see DEPLOY.md) is far below this rate anyway.
const SYNC_COOLDOWN_MS = 30 * 1000;

// In-flight guard — on top of the cooldown above, this stops a second sync from
// starting at all while one is still running (e.g. two requests that both pass the
// cooldown check just before the first one started). syncCourses was already safe to
// run concurrently (upserts keyed on unique constraints), so this isn't a
// correctness fix, just an efficiency one: no reason to pay for two full catalog
// walks when they'd just race each other.
const inFlight = new Set<string>();

// Shared by the BookStack webhook receiver and the manual/cron sync route. Configure
// the webhook in BookStack (Settings > Webhooks) to POST to
// https://<domain>/api/webhooks/bookstack?secret=<BOOKSTACK_WEBHOOK_SECRET>
// on book/chapter/page create/update/delete events. The secret may also be sent as
// an X-Webhook-Secret header instead of the query string — preferred, since a query
// string can end up in proxy/access logs and Referer headers; the query param is
// kept working for existing webhook configurations.
export async function handleSyncRequest(request: Request) {
  const secret = request.headers.get("x-webhook-secret") ?? new URL(request.url).searchParams.get("secret");
  if (!secretMatches(secret, process.env.BOOKSTACK_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const org = await getPrimaryOrganization();

  if (!tryConsumeCooldown(`sync:${org.id}`, SYNC_COOLDOWN_MS)) {
    return NextResponse.json({ error: "sync already ran recently, try again shortly" }, { status: 429 });
  }
  if (inFlight.has(org.id)) {
    return NextResponse.json({ error: "a sync is already in progress" }, { status: 429 });
  }

  inFlight.add(org.id);
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
  } finally {
    inFlight.delete(org.id);
  }
}
