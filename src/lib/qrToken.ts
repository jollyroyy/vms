// QR check-in token helpers: build/parse the payload encoded in a visitor's
// QR code, check expiry, and gate check-in against visit status. Fail-open on
// bad/missing expiry data — a malformed value must never block a guard.
import type { VisitStatus } from '../types/index';

export const QR_SCHEME = 'vms://checkin/';

const TOKEN_PATTERN = /^[A-Za-z0-9-]{16,128}$/;

export type QrGate = { ok: boolean; reason: string | null };

/** Builds the QR payload string for a given check-in token. */
export function buildQrPayload(token: string): string {
  return `${QR_SCHEME}${token}`;
}

/** Extracts and validates the token from a scanned QR payload (or a bare token). Returns null if invalid. */
export function parseQrPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const token = trimmed.startsWith(QR_SCHEME) ? trimmed.slice(QR_SCHEME.length) : trimmed;
  if (trimmed.startsWith('vms://') && !trimmed.startsWith(QR_SCHEME)) return null;
  if (!TOKEN_PATTERN.test(token)) return null;

  return token;
}

/** Returns true only if `expiresAt` parses to a moment strictly before `now`. Fail-open on null/unparseable. */
export function isQrExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < now.getTime();
}

// Direct lookup map, not a fuzzy includes() chain — the compiler enforces
// exhaustiveness whenever a new VisitStatus is added.
const STATUS_BLOCK_REASON: Record<VisitStatus, string | null> = {
  pending_approval: 'This visit is still awaiting approval from the person to meet.',
  approved: null,
  walkin_approved: null,
  checked_in: 'This visitor is already checked in.',
  checked_out: 'This visit has already completed.',
  rejected: 'This visit was rejected.',
  cancelled: 'This visit was cancelled.',
  no_show: 'This visit was marked as a no-show.',
  // Names the day rather than the clock, because that is the actual rule: the
  // pass was good for its day and that day has ended. "The time has passed"
  // would invite the guard to wave through someone who is merely late.
  expired: 'This pass was for an earlier day and has expired.',
};

/** Gates a QR check-in: expiry is checked before status, so an expired QR always reports as expired first. */
export function evaluateQrVisit(
  visit: { status: VisitStatus; qr_expires_at: string | null },
  now: Date = new Date()
): QrGate {
  if (isQrExpired(visit.qr_expires_at, now)) {
    return { ok: false, reason: 'This QR code has expired.' };
  }

  const reason = STATUS_BLOCK_REASON[visit.status];
  return reason === null ? { ok: true, reason: null } : { ok: false, reason };
}
