import { prisma } from "@/lib/prisma";

function baseHandle(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "")
    .slice(0, 24);
  return cleaned || "user";
}

// The technical login key. When someone has an email, this is derived from it and
// never shown to them — they log in with their email. When email is optional and
// left blank, whoever's typing this (a facilitator/admin) sets it directly instead,
// so this function isn't used on that path. Takes an in-flight batch of usernames not
// yet committed to the DB, for bulk imports where many rows resolve in one pass.
export async function generateUniqueUsername(
  seed: string,
  reserved: Set<string> = new Set()
): Promise<string> {
  const base = baseHandle(seed.includes("@") ? seed.split("@")[0] : seed);
  let candidate = base;
  let suffix = 1;

  for (;;) {
    if (!reserved.has(candidate)) {
      const existing = await prisma.user.findUnique({ where: { username: candidate } });
      if (!existing) {
        reserved.add(candidate);
        return candidate;
      }
    }
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
}
