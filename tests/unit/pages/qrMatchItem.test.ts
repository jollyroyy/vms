// Covers visitToMatchItem: the pure mapper that turns a QR-resolved Visit into
// the same MatchItem shape the manual search flow builds. The missing-join
// cases matter most — a guard must never see the literal string "undefined"
// rendered on a check-in card.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { visitToMatchItem } from '../../../src/pages/Guard/qrMatchItem';
import type { Visit } from '../../../src/types/index';

// `dueToday` comes from `isDueToday(visit)`, which reads the real clock (no
// injectable `now`). Pin the system time to a fixed instant that is
// unambiguously mid-day IST on 2026-08-01 — the fixture's scheduled/created
// day — so these tests never flip as real time passes, and so we sit well
// clear of the IST day boundary (see istDayStart in lib/visitExpiry.ts).
const FIXED_NOW = '2026-08-01T08:00:00Z'; // 13:30 IST, 2026-08-01

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FIXED_NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

function makeVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'visit-1',
    ref_number: 'VMS-2026-0001',
    visitor_id: 'visitor-1',
    department_id: 'dept-1',
    host_id: 'host-1',
    purpose: 'meeting',
    photo_path: null,
    photo_data: null,
    status: 'approved',
    checked_in_at: null,
    checked_out_at: null,
    exit_verified: null,
    rejection_reason: null,
    carrying_material: false,
    scheduled_for: '2026-08-01T10:00:00Z',
    qr_token: 'tok-1',
    qr_expires_at: null,
    created_at: '2026-08-01T08:00:00Z',
    visitor: { id: 'visitor-1', phone: '9876543210', full_name: 'Asha Rao', vendor_name: 'Acme Co', id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: '2026-01-01T00:00:00Z' },
    department: { id: 'dept-1', name: 'Finance', code: 'FIN', created_at: '2026-01-01T00:00:00Z' } as Visit['department'],
    host: { id: 'host-1', full_name: 'Ravi Kumar' },
    ...overrides,
  };
}

describe('visitToMatchItem', () => {
  it('fully maps an approved visit', () => {
    const visit = makeVisit();
    const item = visitToMatchItem(visit);
    expect(item).toEqual({
      id: 'pre:visit-1',
      source: 'pre_approved',
      visitorName: 'Asha Rao',
      visitorPhone: '9876543210',
      departmentName: 'Finance',
      purpose: 'meeting',
      hostName: 'Ravi Kumar',
      vendorName: 'Acme Co',
      approvalType: 'pre_approved',
      approvedAt: '2026-08-01T08:00:00Z',
      scheduledFor: '2026-08-01T10:00:00Z',
      dueToday: true,
      visitId: 'visit-1',
      photoUrl: null,
      idType: null,
      idLast4: null,
      refNumber: 'VMS-2026-0001',
    });
  });

  it('maps walkin_approved status to the walkin_approved approval type', () => {
    const item = visitToMatchItem(makeVisit({ status: 'walkin_approved' }));
    expect(item.approvalType).toBe('walkin_approved');
  });

  it('keeps approved status mapped to pre_approved approval type', () => {
    const item = visitToMatchItem(makeVisit({ status: 'approved' }));
    expect(item.approvalType).toBe('pre_approved');
  });

  it('degrades a missing visitor join to empty strings, never "undefined"', () => {
    const item = visitToMatchItem(makeVisit({ visitor: undefined }));
    expect(item.visitorName).toBe('');
    expect(item.visitorPhone).toBe('');
    expect(item.vendorName).toBe('');
    expect(item.visitorName).not.toMatch(/undefined/);
  });

  it('degrades a missing department join to an empty string', () => {
    const item = visitToMatchItem(makeVisit({ department: undefined }));
    expect(item.departmentName).toBe('');
  });

  it('degrades a missing host join to an empty string', () => {
    const item = visitToMatchItem(makeVisit({ host: undefined }));
    expect(item.hostName).toBe('');
  });

  it('degrades all three missing joins at once without throwing', () => {
    expect(() => visitToMatchItem(makeVisit({ visitor: undefined, department: undefined, host: undefined }))).not.toThrow();
    const item = visitToMatchItem(makeVisit({ visitor: undefined, department: undefined, host: undefined }));
    expect(item.visitorName).toBe('');
    expect(item.departmentName).toBe('');
    expect(item.hostName).toBe('');
    expect(item.vendorName).toBe('');
    expect(item.visitorPhone).toBe('');
  });

  it('sets visitId and the pre:-prefixed id from the visit id', () => {
    const item = visitToMatchItem(makeVisit({ id: 'v-42' }));
    expect(item.visitId).toBe('v-42');
    expect(item.id).toBe('pre:v-42');
  });

  it('maps photo_data to photoUrl', () => {
    const item = visitToMatchItem(makeVisit({ photo_data: 'data:image/png;base64,AAAA' }));
    expect(item.photoUrl).toBe('data:image/png;base64,AAAA');
  });

  it('photo_url wins over photo_data when both are set', () => {
    const item = visitToMatchItem(makeVisit({ photo_url: 'https://example.com/photo.jpg', photo_data: 'data:image/png;base64,AAAA' }));
    expect(item.photoUrl).toBe('https://example.com/photo.jpg');
  });

  it('maps visitor id_type and id_last4 directly without redaction', () => {
    const item = visitToMatchItem(makeVisit({
      visitor: { ...makeVisit().visitor, id_type: 'Aadhaar', id_last4: '9646' },
    }));
    expect(item.idType).toBe('Aadhaar');
    expect(item.idLast4).toBe('9646');
  });

  it('pending_approval visit maps to approvedAt null', () => {
    const item = visitToMatchItem(makeVisit({ status: 'pending_approval' }));
    expect(item.approvedAt).toBeNull();
  });

  it('missing visitor join leaves idType and idLast4 as null, never undefined', () => {
    const item = visitToMatchItem(makeVisit({ visitor: undefined }));
    expect(item.idType).toBeNull();
    expect(item.idLast4).toBeNull();
    expect(item.idType).not.toBe(undefined);
    expect(item.idLast4).not.toBe(undefined);
  });

  // The QR gate rejects an EXPIRED pass, but a pass booked for next week is
  // perfectly valid and simply not due yet — the scan path must agree with
  // the manual search path on due-ness, or a guard could scan a QR and get a
  // different answer than searching the same visit by phone would give.
  it('a visit scheduled for a later day maps to dueToday: false', () => {
    const item = visitToMatchItem(makeVisit({ scheduled_for: '2026-08-05T10:00:00Z' }));
    expect(item.dueToday).toBe(false);
  });

  it('a visit scheduled for today maps to dueToday: true', () => {
    const item = visitToMatchItem(makeVisit({ scheduled_for: '2026-08-01T10:00:00Z' }));
    expect(item.dueToday).toBe(true);
  });
});
