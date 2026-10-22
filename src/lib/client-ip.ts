import { headers } from "next/headers";

// Best-effort only: trusts X-Forwarded-For, which nginx sets in this app's documented
// deployment (see DEPLOY.md's `proxy_set_header X-Forwarded-For
// $proxy_add_x_forwarded_for;`). In local dev, or any deployment that doesn't set it,
// every caller collapses to the same "unknown" bucket — acceptable for a volume
// limiter whose job is bounding abuse from one source, not identifying individuals.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}
