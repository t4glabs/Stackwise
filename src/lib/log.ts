import { prisma } from "@/lib/prisma";

// Fixed categories rather than a free-for-all string — keeps the admin /admin/logs
// filter UI a simple dropdown instead of an ever-growing list of one-off values.
export const LOG_TYPES = ["LOGIN", "REGISTER", "VERIFY", "PASSWORD_RESET", "EMAIL", "SYNC"] as const;
export type LogType = (typeof LOG_TYPES)[number];

export const LOG_TYPE_LABELS: Record<LogType, string> = {
  LOGIN: "Login",
  REGISTER: "Registration",
  VERIFY: "Email verification",
  PASSWORD_RESET: "Password reset",
  EMAIL: "Email delivery",
  SYNC: "Content sync",
};

export type LogLevel = "INFO" | "ERROR";

// How long entries stick around before being auto-pruned — see the retention note on
// the EventLog model in schema.prisma.
const PRUNE_AFTER_DAYS = 60;
// Rather than a cron job (this app has none — see DEPLOY.md), each write has a small
// chance of also sweeping its own org's expired rows. Cheap, no extra infra, and
// self-correcting even if a burst of writes is missed.
const PRUNE_CHANCE = 0.05;

// Best-effort and non-blocking by design: a logging failure (e.g. a DB hiccup) should
// never take down the login/email/sync flow it's trying to observe.
export async function logEvent(params: {
  organizationId: string;
  type: LogType;
  level: LogLevel;
  message: string;
  detail?: string | null;
  userId?: string | null;
  email?: string | null;
}): Promise<void> {
  try {
    await prisma.eventLog.create({
      data: {
        organizationId: params.organizationId,
        type: params.type,
        level: params.level,
        message: params.message,
        detail: params.detail ?? null,
        userId: params.userId ?? null,
        email: params.email ?? null,
      },
    });

    if (Math.random() < PRUNE_CHANCE) {
      const cutoff = new Date(Date.now() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000);
      await prisma.eventLog.deleteMany({
        where: { organizationId: params.organizationId, createdAt: { lt: cutoff } },
      });
    }
  } catch {
    // Swallow — see function comment.
  }
}
