import { describe, it, expect } from 'vitest';
import {
  QR_SCHEME,
  buildQrPayload,
  parseQrPayload,
  isQrExpired,
  evaluateQrVisit,
} from '../../../src/lib/qrToken';

const TOKEN = '8f14e45f-ceea-467a-9a4e-3b1c2d5f6a7b';

describe('buildQrPayload', () => {
  it('prefixes the token with the VMS check-in scheme', () => {
    expect(buildQrPayload(TOKEN)).toBe(`${QR_SCHEME}${TOKEN}`);
  });
});

describe('parseQrPayload', () => {
  it('extracts the token from a well-formed payload', () => {
    expect(parseQrPayload(`${QR_SCHEME}${TOKEN}`)).toBe(TOKEN);
  });

  it('accepts a bare token so a manually keyed code still works', () => {
    expect(parseQrPayload(TOKEN)).toBe(TOKEN);
  });

  it('trims surrounding whitespace from a scan', () => {
    expect(parseQrPayload(`  ${QR_SCHEME}${TOKEN}\n`)).toBe(TOKEN);
  });

  it('rejects an unrelated QR code', () => {
    expect(parseQrPayload('https://example.com/promo')).toBeNull();
  });

  it('rejects the legacy badge payload, which carries a ref number not a token', () => {
    expect(parseQrPayload('vms://visit/VMS-2026-0001')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(parseQrPayload('')).toBeNull();
    expect(parseQrPayload('   ')).toBeNull();
  });

  it('rejects a token containing unsafe characters', () => {
    expect(parseQrPayload(`${QR_SCHEME}abc<script>`)).toBeNull();
  });
});

describe('isQrExpired', () => {
  const now = new Date('2026-08-01T10:00:00Z');

  it('is not expired before the expiry moment', () => {
    expect(isQrExpired('2026-08-01T11:00:00Z', now)).toBe(false);
  });

  it('is expired after the expiry moment', () => {
    expect(isQrExpired('2026-08-01T09:59:59Z', now)).toBe(true);
  });

  it('treats a missing expiry as never expiring', () => {
    expect(isQrExpired(null, now)).toBe(false);
  });

  it('treats an unparseable expiry as never expiring, so a bad value cannot block a guard', () => {
    expect(isQrExpired('not-a-date', now)).toBe(false);
  });
});

describe('evaluateQrVisit', () => {
  const now = new Date('2026-08-01T10:00:00Z');
  const future = '2026-08-01T18:00:00Z';

  it('allows an approved visit with a live QR', () => {
    expect(evaluateQrVisit({ status: 'approved', qr_expires_at: future }, now))
      .toEqual({ ok: true, reason: null });
  });

  it('allows a walk-in approved visit', () => {
    expect(evaluateQrVisit({ status: 'walkin_approved', qr_expires_at: future }, now).ok).toBe(true);
  });

  it('blocks an expired QR even when the visit is approved', () => {
    const result = evaluateQrVisit({ status: 'approved', qr_expires_at: '2026-07-31T10:00:00Z' }, now);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  it('blocks a visitor who is already checked in', () => {
    const result = evaluateQrVisit({ status: 'checked_in', qr_expires_at: future }, now);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/already checked in/i);
  });

  it('blocks a visit still awaiting host approval', () => {
    const result = evaluateQrVisit({ status: 'pending_approval', qr_expires_at: future }, now);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/approval/i);
  });

  it.each([
    ['checked_out', /completed/i],
    ['rejected', /rejected/i],
    ['cancelled', /cancelled/i],
    ['no_show', /no.show/i],
  ] as const)('blocks a %s visit', (status, expected) => {
    const result = evaluateQrVisit({ status, qr_expires_at: future }, now);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(expected);
  });

  it('reports expiry ahead of status so the guard sees the actionable problem first', () => {
    const result = evaluateQrVisit({ status: 'pending_approval', qr_expires_at: '2026-07-31T10:00:00Z' }, now);
    expect(result.reason).toMatch(/expired/i);
  });
});
