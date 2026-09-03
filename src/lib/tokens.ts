import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { TokenPurpose } from "@/generated/prisma/client";

const TTL_MS: Record<TokenPurpose, number> = {
  EMAIL_VERIFY: 48 * 60 * 60 * 1000, // 48h — not sensitive, give people time
  PASSWORD_RESET: 60 * 60 * 1000, // 1h — a live account-takeover vector if left open long
};

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// Returns the RAW token — this is the only place it ever exists outside the emailed
// link. Only its hash is persisted (see the VerificationToken model comment).
export async function createToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TTL_MS[purpose]),
    },
  });
  return rawToken;
}

// Validates + marks the token used in one step. Returns the userId on success, or
// null for anything invalid (unknown, wrong purpose, expired, already used) — callers
// shouldn't need to distinguish why, both to keep call sites simple and to avoid
// leaking which failure mode occurred.
export async function consumeToken(rawToken: string, purpose: TokenPurpose): Promise<string | null> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.verificationToken.findUnique({ where: { tokenHash } });

  if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.verificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return record.userId;
}

export function appUrl(path: string): string {
  const base = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
