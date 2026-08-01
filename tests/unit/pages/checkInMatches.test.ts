// Covers buildMatchItems: flattens pre-approved visits and today's recurring
// visitors into one ordered candidate list, filtered by search and department.
// Critical: recurring rows have nulls (not undefined) for photo/id/approval fields,
// and missing joins degrade to '' not the string "undefined".
import { describe, it, expect } from 'vitest';
import { buildMatchItems, type PreApprovedVisit, type RecurringWithDept } from '../../../src/pages/Guard/checkInMatches';
import type { Visit, RecurringVisit, Department, Profile } from '../../../src/types/index';

function makeVisit(overrides: Partial<PreApprovedVisit> = {}): PreApprovedVisit {
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
    visitor: {
      id: 'visitor-1',
      phone: '9876543210',
      full_name: 'Asha Rao',
      company: 'Acme Co',
      id_type: null,
      id_last4: null,
      vehicle_number: null,
      is_blacklisted: false,
      blacklist_reason: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    department: { id: 'dept-1', name: 'Finance', code: 'FIN', created_at: '2026-01-01T00:00:00Z' },
    host: { id: 'host-1', full_name: 'Ravi Kumar' },
    ...overrides,
  };
}

function makeRecurring(overrides: Partial<RecurringWithDept> = {}): RecurringWithDept {
  return {
    id: 'rec-1',
    department_id: 'dept-1',
    host_id: 'host-1',
    created_by: 'user-1',
    visitor_name: 'Priya Singh',
    visitor_phone: '8765432109',
    visitor_company: 'Beta Ltd',
    purpose: 'vendor',
    recurrence_type: 'weekly',
    recurrence_day: 3,
    start_date: '2026-01-01',
    end_date: null,
    is_active: true,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    department: { id: 'dept-1', name: 'Finance', code: 'FIN', created_at: '2026-01-01T00:00:00Z' },
    host: { id: 'host-1', full_name: 'Ravi Kumar' },
    ...overrides,
  };
}

describe('buildMatchItems', () => {
  it('returns empty array when both sources are empty', () => {
    const items = buildMatchItems([], [], { search: '', deptFilter: '' });
    expect(items).toEqual([]);
  });

  describe('pre-approved visits', () => {
    it('maps an approved visit with correct source and id format', () => {
      const items = buildMatchItems([makeVisit()], [], { search: '', deptFilter: '' });
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        id: 'pre:visit-1',
        source: 'pre_approved',
        visitId: 'visit-1',
        approvalType: 'pre_approved',
      });
    });

    it('maps walkin_approved status to walkin_approved approval type', () => {
      const items = buildMatchItems([makeVisit({ status: 'walkin_approved' })], [], { search: '', deptFilter: '' });
      expect(items[0].approvalType).toBe('walkin_approved');
    });

    it('uses explicit approvedAt when present', () => {
      const items = buildMatchItems([makeVisit({ approvedAt: '2026-06-30T14:05:00Z' })], [], { search: '', deptFilter: '' });
      expect(items[0].approvedAt).toBe('2026-06-30T14:05:00Z');
    });

    it('falls back to created_at when approvedAt is not set', () => {
      const items = buildMatchItems([makeVisit({ created_at: '2026-08-01T08:00:00Z', approvedAt: undefined })], [], { search: '', deptFilter: '' });
      expect(items[0].approvedAt).toBe('2026-08-01T08:00:00Z');
    });

    it('prefers photo_url over photo_data', () => {
      const items = buildMatchItems([makeVisit({ photo_url: 'https://example.com/photo.jpg', photo_data: 'data:image/png;base64,AAAA' })], [], { search: '', deptFilter: '' });
      expect(items[0].photoUrl).toBe('https://example.com/photo.jpg');
    });

    it('uses photo_data when photo_url is absent', () => {
      const items = buildMatchItems([makeVisit({ photo_data: 'data:image/png;base64,AAAA', photo_url: undefined })], [], { search: '', deptFilter: '' });
      expect(items[0].photoUrl).toBe('data:image/png;base64,AAAA');
    });

    it('carries through idType, idLast4, and refNumber', () => {
      const items = buildMatchItems([makeVisit({
        ref_number: 'VMS-2026-0042',
        visitor: { ...makeVisit().visitor!, id_type: 'Aadhaar', id_last4: '9646' },
      })], [], { search: '', deptFilter: '' });
      expect(items[0]).toMatchObject({
        idType: 'Aadhaar',
        idLast4: '9646',
        refNumber: 'VMS-2026-0042',
      });
    });

    it('degrades missing visitor join to empty strings, not "undefined"', () => {
      const items = buildMatchItems([makeVisit({ visitor: undefined })], [], { search: '', deptFilter: '' });
      expect(items[0].visitorName).toBe('');
      expect(items[0].visitorPhone).toBe('');
      expect(items[0].company).toBe('');
      expect(items[0].visitorName).not.toMatch(/undefined/);
    });

    it('degrades missing department join to empty string', () => {
      const items = buildMatchItems([makeVisit({ department: undefined })], [], { search: '', deptFilter: '' });
      expect(items[0].departmentName).toBe('');
    });

    it('degrades missing host join to empty string', () => {
      const items = buildMatchItems([makeVisit({ host: undefined })], [], { search: '', deptFilter: '' });
      expect(items[0].hostName).toBe('');
    });
  });

  describe('recurring visits', () => {
    it('maps a recurring row with correct source and id format', () => {
      const items = buildMatchItems([], [makeRecurring()], { search: '', deptFilter: '' });
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        id: 'rec:dept-1:host-1',
        source: 'recurring',
        approvalType: 'recurring',
      });
    });

    it('sets all approval-related fields to null for recurring rows', () => {
      const items = buildMatchItems([], [makeRecurring()], { search: '', deptFilter: '' });
      expect(items[0]).toMatchObject({
        approvedAt: null,
        photoUrl: null,
        idType: null,
        idLast4: null,
        refNumber: null,
      });
      expect(items[0].approvedAt).not.toBe(undefined);
      expect(items[0].photoUrl).not.toBe(undefined);
      expect(items[0].idType).not.toBe(undefined);
    });

    it('does not set visitId on recurring rows', () => {
      const items = buildMatchItems([], [makeRecurring()], { search: '', deptFilter: '' });
      expect(items[0].visitId).toBeUndefined();
    });

    it('degrades missing department join to empty string', () => {
      const items = buildMatchItems([], [makeRecurring({ department: undefined })], { search: '', deptFilter: '' });
      expect(items[0].departmentName).toBe('');
    });

    it('degrades missing host join to empty string', () => {
      const items = buildMatchItems([], [makeRecurring({ host: undefined })], { search: '', deptFilter: '' });
      expect(items[0].hostName).toBe('');
    });
  });

  describe('search filtering', () => {
    it('keeps rows matching visitor name (case-insensitive)', () => {
      const items = buildMatchItems([makeVisit({ visitor: { ...makeVisit().visitor!, full_name: 'Asha Rao' } })], [], { search: 'asha', deptFilter: '' });
      expect(items).toHaveLength(1);
    });

    it('keeps rows matching phone number', () => {
      const items = buildMatchItems([makeVisit({ visitor: { ...makeVisit().visitor!, phone: '9876543210' } })], [], { search: '9876543210', deptFilter: '' });
      expect(items).toHaveLength(1);
    });

    it('drops rows not matching search term', () => {
      const items = buildMatchItems([makeVisit({ visitor: { ...makeVisit().visitor!, full_name: 'Asha Rao' } })], [], { search: 'nomatch', deptFilter: '' });
      expect(items).toHaveLength(0);
    });

    it('keeps all rows when search is empty', () => {
      const items = buildMatchItems([makeVisit()], [makeRecurring()], { search: '', deptFilter: '' });
      expect(items).toHaveLength(2);
    });

    it('keeps all rows when search is whitespace only', () => {
      const items = buildMatchItems([makeVisit()], [makeRecurring()], { search: '   ', deptFilter: '' });
      expect(items).toHaveLength(2);
    });

    it('applies search filter to recurring rows too', () => {
      const items = buildMatchItems([], [makeRecurring({ visitor_name: 'Priya Singh' })], { search: 'priya', deptFilter: '' });
      expect(items).toHaveLength(1);
    });
  });

  describe('department filtering', () => {
    it('keeps rows matching department filter', () => {
      const items = buildMatchItems([makeVisit({ department_id: 'dept-1' })], [], { search: '', deptFilter: 'dept-1' });
      expect(items).toHaveLength(1);
    });

    it('drops rows not matching department filter', () => {
      const items = buildMatchItems([makeVisit({ department_id: 'dept-1' })], [], { search: '', deptFilter: 'dept-2' });
      expect(items).toHaveLength(0);
    });

    it('keeps all rows when deptFilter is empty', () => {
      const items = buildMatchItems([makeVisit({ department_id: 'dept-1' }), makeVisit({ id: 'visit-2', department_id: 'dept-2' })], [], { search: '', deptFilter: '' });
      expect(items).toHaveLength(2);
    });

    it('applies department filter to recurring rows too', () => {
      const items = buildMatchItems([], [makeRecurring({ department_id: 'dept-1' })], { search: '', deptFilter: 'dept-2' });
      expect(items).toHaveLength(0);
    });
  });

  describe('combined filters', () => {
    it('applies both search and department filters', () => {
      const items = buildMatchItems(
        [makeVisit({ visitor: { ...makeVisit().visitor!, full_name: 'Asha Rao' }, department_id: 'dept-1' })],
        [],
        { search: 'asha', deptFilter: 'dept-1' },
      );
      expect(items).toHaveLength(1);
    });

    it('drops rows failing either filter', () => {
      const items = buildMatchItems(
        [makeVisit({ visitor: { ...makeVisit().visitor!, full_name: 'Asha Rao' }, department_id: 'dept-1' })],
        [],
        { search: 'nomatch', deptFilter: 'dept-1' },
      );
      expect(items).toHaveLength(0);
    });
  });

  describe('ordering', () => {
    it('returns approved visits before recurring rows', () => {
      const items = buildMatchItems([makeVisit()], [makeRecurring()], { search: '', deptFilter: '' });
      expect(items).toHaveLength(2);
      expect(items[0].source).toBe('pre_approved');
      expect(items[1].source).toBe('recurring');
    });

    it('maintains order within each group', () => {
      const v1 = makeVisit({ id: 'visit-1' });
      const v2 = makeVisit({ id: 'visit-2' });
      const r1 = makeRecurring({ id: 'rec-1' });
      const r2 = makeRecurring({ id: 'rec-2' });
      const items = buildMatchItems([v1, v2], [r1, r2], { search: '', deptFilter: '' });
      expect(items).toHaveLength(4);
      expect(items[0].id).toBe('pre:visit-1');
      expect(items[1].id).toBe('pre:visit-2');
      expect(items[2].id).toMatch(/^rec:/);
      expect(items[3].id).toMatch(/^rec:/);
    });
  });
});
