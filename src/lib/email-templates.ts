// Deliberately plain — transactional emails render most reliably (and least
// suspiciously) as simple text-first HTML, not a styled marketing template.

function stripTags(line: string): string {
  return line
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a href="([^"]+)">.*?<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "");
}

// name/orgName/identifier/password are all end-user-editable (a learner's own name,
// an org's brand name set in /admin/settings, etc.) and end up spliced straight into
// this HTML — without escaping, a name like `<img src=x onerror=...>` would inject
// live markup into every transactional email sent about that person, not just render
// as literal text. subject lines go through a real mail header, not HTML, so they're
// deliberately left alone here.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrap(orgName: string, bodyLines: string[]): { html: string; text: string } {
  const safeOrgName = escapeHtml(orgName);
  const text = bodyLines.map(stripTags).join("\n\n") + `\n\n— ${orgName}`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; font-size: 15px; line-height: 1.6; color: #1f2421; max-width: 480px;">
      ${bodyLines.map((line) => `<p>${line}</p>`).join("\n")}
      <p style="color: #6b635e; font-size: 13px; margin-top: 24px;">— ${safeOrgName}</p>
    </div>
  `;
  return { html, text };
}

export function verifyEmailTemplate(orgName: string, name: string, link: string) {
  return {
    subject: `Confirm your email for ${orgName}`,
    ...wrap(orgName, [
      `Hi ${escapeHtml(name)},`,
      `Click the link below to confirm your email and activate your account:`,
      `<a href="${link}">${link}</a>`,
      `This link expires in 48 hours. If you didn't create this account, you can ignore this email.`,
    ]),
  };
}

export function passwordResetTemplate(orgName: string, name: string, link: string) {
  return {
    subject: `Reset your password for ${orgName}`,
    ...wrap(orgName, [
      `Hi ${escapeHtml(name)},`,
      `Someone requested a password reset for your account. Click the link below to set a new password:`,
      `<a href="${link}">${link}</a>`,
      `This link expires in 1 hour. If you didn't request this, you can ignore this email — your password won't change.`,
    ]),
  };
}

// For new admin accounts (seeded at deploy time, or added by another admin) — no
// temp password is ever generated for this role; the account is unusable until this
// link is used. See lib/tokens.ts (reuses PASSWORD_RESET — functionally identical:
// prove email ownership, then set a password) and prisma/seed.ts.
export function adminSetupTemplate(orgName: string, name: string, link: string) {
  return {
    subject: `Set up your admin account for ${orgName}`,
    ...wrap(orgName, [
      `Hi ${escapeHtml(name)},`,
      `You've been given admin access to ${orgName}. Click the link below to set your password and log in:`,
      `<a href="${link}">${link}</a>`,
      `This link expires in 1 hour — if it's expired, use "Forgot password" on the login page to get a new one.`,
    ]),
  };
}

export function credentialsTemplate(orgName: string, name: string, identifier: string, password: string) {
  return {
    subject: `Your ${orgName} login details`,
    ...wrap(orgName, [
      `Hi ${escapeHtml(name)},`,
      `An account was created for you. Here's how to log in:`,
      `Login: ${escapeHtml(identifier)}<br/>Password: ${escapeHtml(password)}`,
      `We'd recommend changing your password after your first login.`,
    ]),
  };
}
