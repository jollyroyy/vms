// Covers visitToMatchItem: the pure mapper that turns a QR-resolved Visit into
// the same MatchItem shape the manual search flow builds. The missing-join
// cases matter most — a guard must never see the literal string "undefined"
// rendered on a check-in card.
import { describe, it, expect } from 'vitest';
import { visitToMatchItem } from '../../../src/pages/Guard/qrMatchItem';
import type { Visit } from '../../../src/types/index';

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
    visitor: { id: 'visitor-1', phone: '9876543210', full_name: 'Asha Rao', company: 'Acme Co', id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: '2026-01-01T00:00:00Z' },
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
      company: 'Acme Co',
      approvalType: 'pre_approved',
      approvedAt: '2026-08-01T08:00:00Z',
      scheduledFor: '2026-08-01T10:00:00Z',
      visitId: 'visit-1',
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
    expect(item.company).toBe('');
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
    expect(item.company).toBe('');
    expect(item.visitorPhone).toBe('');
  });

  it('sets visitId and the pre:-prefixed id from the visit id', () => {
    const item = visitToMatchItem(makeVisit({ id: 'v-42' }));
    expect(item.visitId).toBe('v-42');
    expect(item.id).toBe('pre:v-42');
  });
});
