import { handleSyncRequest } from "@/lib/sync-handler";

// Scheduled backstop for the webhook (pm2/cron hits this every 15-30 min — see
// DEPLOY.md) in case a webhook delivery is missed.
export async function GET(request: Request) {
  return handleSyncRequest(request);
}

export async function POST(request: Request) {
  return handleSyncRequest(request);
}
