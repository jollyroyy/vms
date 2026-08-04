// Covers buildMatchItems' search box + department picker filtering. Row
// shape/mapping lives in checkInMatches.test.ts — split to stay under the
// 300-line file cap. matches() also checks ref_number (case-insensitive
// substring) and compares phones digits-only, so a typed "98765 43210" or
// "+91-98765-43210" still matches a stored "+919876543210" — see
// src/pages/Guard/checkInMatches.ts.
import { describe, it, expect } from 'vitest';
import { buildMatchItems } from '../../../src/pages/Guard/checkInMatches';
import { makeVisit, makeRecurring } from './checkInMatchesFixtures';

describe('buildMatchItems filtering', () => {
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

    // A guard reading a pass off a phone screen types the ref number, not the
    // name — it used to return nothing because ref_number wasn't searched.
    it('keeps rows matching the full ref number', () => {
      const items = buildMatchItems([makeVisit({ ref_number: 'VMS-2026-0042' })], [], { search: 'VMS-2026-0042', deptFilter: '' });
      expect(items).toHaveLength(1);
    });

    it('keeps rows matching a lowercase, partial ref number', () => {
      const items = buildMatchItems([makeVisit({ ref_number: 'VMS-2026-0042' })], [], { search: 'vms-2026', deptFilter: '' });
      expect(items).toHaveLength(1);
    });

    // Phones are compared digits-only so guard-typed punctuation never kills
    // an otherwise-correct match.
    it('matches a phone typed with spaces against a stored plain digit string', () => {
      const items = buildMatchItems([makeVisit({ visitor: { ...makeVisit().visitor!, phone: '+919876543210' } })], [], { search: '98765 43210', deptFilter: '' });
      expect(items).toHaveLength(1);
    });

    it('matches a phone typed with a country code and dashes', () => {
      const items = buildMatchItems([makeVisit({ visitor: { ...makeVisit().visitor!, phone: '+919876543210' } })], [], { search: '+91-98765-43210', deptFilter: '' });
      expect(items).toHaveLength(1);
    });

    it('returns nothing when the query matches neither name, phone nor ref number', () => {
      const items = buildMatchItems([makeVisit({ ref_number: 'VMS-2026-0042', visitor: { ...makeVisit().visitor!, full_name: 'Asha Rao', phone: '9876543210' } })], [], { search: 'zzz-no-match', deptFilter: '' });
      expect(items).toHaveLength(0);
    });

    it('applies the department filter on top of a ref-number match', () => {
      const items = buildMatchItems([makeVisit({ ref_number: 'VMS-2026-0042', department_id: 'dept-1' })], [], { search: 'vms-2026-0042', deptFilter: 'dept-2' });
      expect(items).toHaveLength(0);
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
});
