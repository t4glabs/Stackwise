import { handleSyncRequest } from "@/lib/sync-handler";

export async function POST(request: Request) {
  return handleSyncRequest(request);
}
