// Covers buildMatchItems' dueToday rule: the live DB had only future-dated
// pre-approvals, so the empty-search (browsing) board was always empty and a
// guard searching a visitor holding a valid pass got "No match found". Row
// shape/mapping lives in checkInMatches.test.ts, filter mechanics live in
// checkInMatchesFilters.test.ts — split to stay under the 300-line file cap.
import { describe, it, expect } from 'vitest';
import { buildMatchItems } from '../../../src/pages/Guard/checkInMatches';
import { makeVisit, makeRecurring } from './checkInMatchesFixtures';

// Fixed instant so "today" and "tomorrow" are pinned relative to each other,
// not to the real clock — deterministic regardless of when the suite runs.
const now = new Date('2026-08-11T06:00:00Z');
const scheduledToday = '2026-08-11T08:00:00Z';
const scheduledTomorrow = '2026-08-12T08:00:00Z';

describe('buildMatchItems dueToday rule', () => {
  it('omits a pre-approval scheduled for tomorrow when the search box is empty', () => {
    const items = buildMatchItems(
      [makeVisit({ scheduled_for: scheduledTomorrow })],
      [],
      { search: '', deptFilter: '' },
      now,
    );
    expect(items).toHaveLength(0);
  });

  it('returns that same visitor, with dueToday false, when the search matches their name', () => {
    const items = buildMatchItems(
      [makeVisit({
        scheduled_for: scheduledTomorrow,
        visitor: { ...makeVisit().visitor!, full_name: 'Asha Rao' },
      })],
      [],
      { search: 'asha', deptFilter: '' },
      now,
    );
    expect(items).toHaveLength(1);
    expect(items[0].dueToday).toBe(false);
  });

  it('returns that same visitor when the search matches their phone, formatted with spaces', () => {
    const items = buildMatchItems(
      [makeVisit({
        scheduled_for: scheduledTomorrow,
        visitor: { ...makeVisit().visitor!, phone: '+919876543210' },
      })],
      [],
      { search: '98765 43210', deptFilter: '' },
      now,
    );
    expect(items).toHaveLength(1);
    expect(items[0].dueToday).toBe(false);
  });

  it('marks a pre-approval scheduled for today as dueToday, and returns it with an empty search', () => {
    const items = buildMatchItems(
      [makeVisit({ scheduled_for: scheduledToday })],
      [],
      { search: '', deptFilter: '' },
      now,
    );
    expect(items).toHaveLength(1);
    expect(items[0].dueToday).toBe(true);
  });

  it('always marks a recurring row as dueToday, since the caller already filtered it to today', () => {
    const items = buildMatchItems([], [makeRecurring()], { search: '', deptFilter: '' }, now);
    expect(items).toHaveLength(1);
    expect(items[0].dueToday).toBe(true);
  });
});
