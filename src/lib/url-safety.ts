import dns from "node:dns/promises";
import net from "node:net";

// Covers RFC 1918 private ranges, loopback, link-local (incl. the cloud metadata
// address 169.254.169.254), carrier-grade NAT, and multicast/reserved space.
const PRIVATE_V4_RANGES: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
];

function ipv4ToLong(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const target = ipv4ToLong(ip);
  return PRIVATE_V4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (target & mask) === (ipv4ToLong(base) & mask);
  });
}

// Not an exhaustive IPv6 range table, but covers loopback, link-local, and
// unique-local (the IPv6 analogues of the IPv4 ranges above) plus IPv4-mapped
// addresses, which is what an attacker would actually reach for.
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isPrivateIPv4(v4Mapped[1]);
  return false;
}

function isPrivateAddress(address: string, family: number): boolean {
  return family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
}

// Resolves the hostname (if it isn't already a literal IP) and rejects the URL if
// any resolved address — or the literal IP itself — falls in a private/internal
// range. Resolving rather than string-matching the hostname is what keeps this safe
// against DNS rebinding (a public-looking hostname that resolves to 127.0.0.1).
export async function isUrlSafeToFetch(rawUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const hostname = url.hostname;
  const literalFamily = net.isIP(hostname);
  if (literalFamily) {
    return !isPrivateAddress(hostname, literalFamily);
  }

  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (addresses.length === 0) return false;
    return addresses.every((a) => !isPrivateAddress(a.address, a.family));
  } catch {
    // Unresolvable host — fail closed rather than let an unvalidated URL through.
    return false;
  }
}

// Removes any <img> tag whose src doesn't resolve to a safe public address, so a
// downstream HTML-to-document converter that auto-fetches image URLs (e.g.
// @turbodocx/html-to-docx) can never be made to reach an internal service or a cloud
// metadata endpoint via BookStack-authored content. BookStack's own WYSIWYG editor
// only ever emits <img src="..."> (no srcset), so a single-attribute match covers it.
export async function stripUnsafeImages(html: string): Promise<string> {
  const imgSrcRe = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  const matches = [...html.matchAll(imgSrcRe)];
  if (matches.length === 0) return html;

  const safety = new Map<string, boolean>();
  for (const match of matches) {
    const src = match[1];
    if (!safety.has(src)) {
      safety.set(src, await isUrlSafeToFetch(src));
    }
  }

  return html.replace(imgSrcRe, (full, src: string) => (safety.get(src) ? full : ""));
}
