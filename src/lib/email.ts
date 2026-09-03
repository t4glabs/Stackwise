// Thin Mailgun client, mirroring the "not configured" pattern already used for
// BookStack (see lib/bookstack.ts) — the whole app should keep working locally
// without real Mailgun keys, just falling back to logging what would have been sent.

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

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const { apiKey, domain, from, baseUrl } = getConfig();

  if (!apiKey || !domain || !from) {
    // Dev fallback: no Mailgun keys set. Log the content (with any link intact) so
    // the verify/reset flows stay testable without real email delivery.
    console.log(`\n[email:not-configured] Would send to ${to} — "${subject}"\n${text}\n`);
    return;
  }

  const body = new URLSearchParams({ from, to, subject, html, text });

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
    throw new Error(`Mailgun send failed: ${res.status} ${res.statusText} ${detail}`);
  }
}
