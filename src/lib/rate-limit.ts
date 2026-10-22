// In-process lockout limiter — sufficient for this app's single pm2-process
// deployment model (see DEPLOY.md); if a deployment ever scales to multiple
// instances, this would need to move to a shared store (e.g. Redis) since each
// process would otherwise track its own counters independently.
//
// Keyed per-caller (e.g. a login identifier or an email address), not per-IP: the
// goal is to make guessing a specific account's credential impractical regardless of
// how many source IPs an attacker spreads attempts across.
type Entry = { count: number; firstAttemptAt: number; lockedUntil?: number };

const attempts = new Map<string, Entry>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// Keep the map from growing unboundedly under sustained attack traffic — a stale
// entry (outside the window and not locked) is worthless to keep around.
function sweepIfStale(key: string, entry: Entry, now: number): Entry | undefined {
  const stillLocked = entry.lockedUntil && entry.lockedUntil > now;
  const withinWindow = now - entry.firstAttemptAt <= WINDOW_MS;
  if (stillLocked || withinWindow) return entry;
  attempts.delete(key);
  return undefined;
}

// Call before attempting the privileged operation (verifying a password, sending a
// reset/verification email, etc). Returns the remaining lockout time in ms if the
// key is currently locked out, or null if the attempt may proceed.
export function checkLockout(key: string): number | null {
  const now = Date.now();
  const entry = sweepIfStale(key, attempts.get(key) ?? { count: 0, firstAttemptAt: now }, now);
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return entry.lockedUntil - now;
  }
  return null;
}

// Call after a failed attempt. Once MAX_ATTEMPTS is reached within WINDOW_MS, the key
// is locked out for LOCKOUT_MS regardless of further attempts.
export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const existing = sweepIfStale(key, attempts.get(key) ?? { count: 0, firstAttemptAt: now }, now);
  const entry: Entry = existing ?? { count: 0, firstAttemptAt: now };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  attempts.set(key, entry);
}

// Call after a successful attempt — clears the counter so a legitimate user who
// mistyped a few times isn't penalized once they get it right.
export function recordSuccess(key: string): void {
  attempts.delete(key);
}

// A plain fixed cooldown, independent of the failure-counting lockout above — for
// endpoints that return the same response to the caller regardless of outcome (so
// there's no "failure" to count) but still trigger a side effect — an email send —
// that shouldn't be repeatable in a tight loop against the same recipient. Returns
// true and starts the cooldown if the key is currently free, false if it's still
// cooling down. One call per attempt: skip the side effect (but still return the
// caller's normal response) when this returns false.
const cooldowns = new Map<string, number>(); // key -> timestamp the cooldown ends

export function tryConsumeCooldown(key: string, cooldownMs: number): boolean {
  const now = Date.now();
  const endsAt = cooldowns.get(key);
  if (endsAt && endsAt > now) return false;
  cooldowns.set(key, now + cooldownMs);
  return true;
}

// A simple fixed-window counter — allows up to `maxCount` calls per `windowMs` for a
// given key, then rejects further calls until the window rolls over. Used for
// per-source-IP throttling (e.g. registration volume) where, unlike the lockout
// above, there's no single "account" being guessed — the goal is just bounding
// overall volume from one source.
const windows = new Map<string, { count: number; windowStartedAt: number }>();

export function checkWindowedLimit(key: string, maxCount: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = windows.get(key);
  if (!existing || now - existing.windowStartedAt > windowMs) {
    windows.set(key, { count: 1, windowStartedAt: now });
    return true;
  }
  if (existing.count >= maxCount) return false;
  existing.count += 1;
  return true;
}
