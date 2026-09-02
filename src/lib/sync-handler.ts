import { NextResponse } from "next/server";
import { syncCourses } from "@/lib/sync";
import { getPrimaryOrganization } from "@/lib/org";

// Shared by the BookStack webhook receiver and the manual/cron sync route. Configure
// the webhook in BookStack (Settings > Webhooks) to POST to
// https://<domain>/api/webhooks/bookstack?secret=<BOOKSTACK_WEBHOOK_SECRET>
// on book/chapter/page create/update/delete events.
export async function handleSyncRequest(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!process.env.BOOKSTACK_WEBHOOK_SECRET || secret !== process.env.BOOKSTACK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const org = await getPrimaryOrganization();
  const result = await syncCourses(org);
  return NextResponse.json(result);
}
