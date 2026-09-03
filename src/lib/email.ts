// Thin Mailgun client, mirroring the "not configured" pattern already used for
// BookStack (see lib/bookstack.ts) — the whole app should keep working locally
// without real Mailgun keys, just falling back to logging what would have been sent.

import { logEvent } from "@/lib/log";

function getConfig() {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM_EMAIL || (domain ? `Stackwise <noreply@${domain}>` : undefined);
  // Mailgun's EU region uses a different API host; default to the US one.
  const baseUrl = (process.env.MAILGUN_BASE_URL || "https://api.mailgun.net").replace(/\/$/, "");
  return { apiKey, domain, from, baseUrl };
}

export function emailIsConfigured(): boolean {
  const { apiKey, domain } = getConfig();
  return Boolean(apiKey && domain);
}

// `context` ties every send attempt back to an org/user for /admin/logs — see
// lib/log.ts. sendEmail never throws: a real Mailgun outage shouldn't blow up the
// server action that called it (the account is usually already created by that
// point); callers get a boolean and the failure is recorded for an admin to see.
export async function sendEmail({
  to,
  subject,
  html,
  text,
  context,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  context: { organizationId: string; purpose: string; userId?: string | null };
}): Promise<boolean> {
  const { apiKey, domain, from, baseUrl } = getConfig();

  if (!apiKey || !domain || !from) {
    // Dev fallback: no Mailgun keys set. Log the content (with any link intact) so
    // the verify/reset flows stay testable without real email delivery.
    console.log(`\n[email:not-configured] Would send to ${to} — "${subject}"\n${text}\n`);
    await logEvent({
      organizationId: context.organizationId,
      type: "EMAIL",
      level: "INFO",
      message: `${context.purpose} email to ${to} (Mailgun not configured — logged instead of sent)`,
      userId: context.userId,
      email: to,
    });
    return true;
  }

  const body = new URLSearchParams({ from, to, subject, html, text });

  try {
    const res = await fetch(`${baseUrl}/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      await logEvent({
        organizationId: context.organizationId,
        type: "EMAIL",
        level: "ERROR",
        message: `Failed to send ${context.purpose} email to ${to}`,
        detail: `${res.status} ${res.statusText} ${detail}`.trim(),
        userId: context.userId,
        email: to,
      });
      return false;
    }

    await logEvent({
      organizationId: context.organizationId,
      type: "EMAIL",
      level: "INFO",
      message: `Sent ${context.purpose} email to ${to}`,
      userId: context.userId,
      email: to,
    });
    return true;
  } catch (error) {
    await logEvent({
      organizationId: context.organizationId,
      type: "EMAIL",
      level: "ERROR",
      message: `Failed to send ${context.purpose} email to ${to}`,
      detail: error instanceof Error ? error.message : String(error),
      userId: context.userId,
      email: to,
    });
    return false;
  }
}
