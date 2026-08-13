// Covers buildMatchItems: flattens pre-approved visits and today's recurring
// visitors into one ordered candidate list. Critical: recurring rows have
// nulls (not undefined) for photo/id/approval fields, and missing joins
// degrade to '' not the string "undefined". Filter behaviour (search box +
// department picker) lives in checkInMatchesFilters.test.ts — split to stay
// under the 300-line file cap.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { freezeIstClock, unfreezeIstClock } from '../helpers/istClock';
import { buildMatchItems } from '../../../src/pages/Guard/checkInMatches';
import { makeVisit, makeRecurring } from './checkInMatchesFixtures';

// Frozen at midday IST: the fixtures below are anchored to "today", and since
// migration 075 ended the IST day at 22:00 they stop being due today for the
// last two hours of every real day. See tests/unit/helpers/istClock.ts.
beforeEach(() => { freezeIstClock(); });
afterEach(() => { unfreezeIstClock(); });

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
      expect(items[0].vendorName).toBe('');
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
