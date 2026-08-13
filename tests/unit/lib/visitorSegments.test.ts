import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  VISITOR_SEGMENTS, SEGMENT_SLUG, SEGMENT_META, SEGMENT_FILTER, OPEN_STATUSES,
  segmentPath, segmentFromSlug, segmentVisits, visitorLoadFilter,
} from '../../../src/lib/visitorSegments';
import type { ListSegment } from '../../../src/lib/visitorSegments';
import type { Visit } from '../../../src/types/index';

const at = (iso: string) => new Date(iso);

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1', ref_number: 'VIS-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    purpose: 'meeting', photo_path: null, photo_data: null, status: 'approved',
    checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
    carrying_material: false, scheduled_for: null, qr_token: 't', qr_expires_at: null,
    created_at: '2026-08-11T04:00:00Z',
    ...overrides,
  } as Visit;
}

describe('segmentPath', () => {
  it('"all" is the bare /visitors route with no slug', () => {
    expect(segmentPath('all')).toBe('/visitors');
  });

  it('every other segment is /visitors/<slug>', () => {
    VISITOR_SEGMENTS.filter((s) => s !== 'all').forEach((s) => {
      expect(segmentPath(s)).toBe(`/visitors/${SEGMENT_SLUG[s]}`);
    });
  });
});

describe('segmentFromSlug', () => {
  it('maps every current slug back to its own segment', () => {
    VISITOR_SEGMENTS.forEach((s) => {
      const slug = SEGMENT_SLUG[s];
      if (slug) expect(segmentFromSlug(slug)).toBe(s);
    });
  });

  // Legacy ?tab= values from the old tab-bar console. These live in bookmarks
  // and old dashboard tiles and must never 404 into a blank page.
  it('maps every legacy ?tab= alias onto a live segment', () => {
    expect(segmentFromSlug('walkins')).toBe('walkin');
    expect(segmentFromSlug('walkin-approved')).toBe('walkinApproved');
    expect(segmentFromSlug('checkin')).toBe('expected');
    expect(segmentFromSlug('exit')).toBe('inside');
    expect(segmentFromSlug('rejected')).toBe('all');
    expect(segmentFromSlug('all')).toBe('all');
    expect(segmentFromSlug('no-show')).toBe('all');
  });

  it('degrades unknown, undefined, null and empty input onto "all" rather than throwing', () => {
    expect(segmentFromSlug('not-a-real-slug')).toBe('all');
    expect(segmentFromSlug(undefined)).toBe('all');
    expect(segmentFromSlug(null)).toBe('all');
    expect(segmentFromSlug('')).toBe('all');
  });
});

describe('completeness — every segment the nav can list must be renderable', () => {
  it('SEGMENT_META has an entry for every VisitorSegment', () => {
    VISITOR_SEGMENTS.forEach((s) => {
      expect(SEGMENT_META[s]).toBeTruthy();
      expect(SEGMENT_META[s].navLabel).toBeTruthy();
      expect(SEGMENT_META[s].title).toBeTruthy();
    });
  });

  it('SEGMENT_FILTER has an entry for every segment except "walkin", which is a form not a list', () => {
    const listSegments = VISITOR_SEGMENTS.filter((s) => s !== 'walkin') as ListSegment[];
    listSegments.forEach((s) => {
      expect(typeof SEGMENT_FILTER[s]).toBe('function');
    });
    expect(SEGMENT_FILTER).not.toHaveProperty('walkin');
  });
});

describe('SEGMENT_FILTER.expected — due today, not merely approved', () => {
  // SEGMENT_FILTER.expected calls isDueToday(v) with no injectable `now`, so the
  // only deterministic way to test it is to pin the system clock rather than
  // depend on the real "today".
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(at('2026-08-11T04:00:00Z')); // 2026-08-11 09:30 IST
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('includes an approved visit booked for today', () => {
    const v = visit({ status: 'approved', scheduled_for: '2026-08-11T10:00:00Z', created_at: '2026-08-04T09:00:00Z' });
    expect(SEGMENT_FILTER.expected(v)).toBe(true);
  });

  // THE BUG this segment exists to prevent: a future booking read as an
  // arrival due now.
  it('excludes a future booking', () => {
    const v = visit({ status: 'approved', scheduled_for: '2099-01-01T10:00:00Z' });
    expect(SEGMENT_FILTER.expected(v)).toBe(false);
  });

  it('excludes an approved visit whose day has already passed', () => {
    const v = visit({ status: 'approved', scheduled_for: '2026-08-09T10:00:00Z' });
    expect(SEGMENT_FILTER.expected(v)).toBe(false);
  });

  it('excludes a non-approved status even if scheduled for today', () => {
    const v = visit({ status: 'pending_approval', scheduled_for: '2026-08-11T10:00:00Z' });
    expect(SEGMENT_FILTER.expected(v)).toBe(false);
  });

  it('excludes an approved visit already checked in', () => {
    const v = visit({
      status: 'approved',
      scheduled_for: '2026-08-11T10:00:00Z',
      checked_in_at: '2026-08-11T10:05:00Z',
    });
    expect(SEGMENT_FILTER.expected(v)).toBe(false);
  });
});

describe('SEGMENT_FILTER — simple status matches', () => {
  it('inside is checked_in only', () => {
    expect(SEGMENT_FILTER.inside(visit({ status: 'checked_in' }))).toBe(true);
    expect(SEGMENT_FILTER.inside(visit({ status: 'checked_out' }))).toBe(false);
  });

  it('pending is pending_approval only', () => {
    expect(SEGMENT_FILTER.pending(visit({ status: 'pending_approval' }))).toBe(true);
    expect(SEGMENT_FILTER.pending(visit({ status: 'approved' }))).toBe(false);
  });

  it('walkinApproved is walkin_approved only', () => {
    expect(SEGMENT_FILTER.walkinApproved(visit({ status: 'walkin_approved' }))).toBe(true);
    expect(SEGMENT_FILTER.walkinApproved(visit({ status: 'approved' }))).toBe(false);
  });

  it('checkedOut is checked_out only', () => {
    expect(SEGMENT_FILTER.checkedOut(visit({ status: 'checked_out' }))).toBe(true);
    expect(SEGMENT_FILTER.checkedOut(visit({ status: 'checked_in' }))).toBe(false);
  });

  it('all matches everything regardless of status', () => {
    expect(SEGMENT_FILTER.all(visit({ status: 'rejected' }))).toBe(true);
    expect(SEGMENT_FILTER.all(visit({ status: 'checked_in' }))).toBe(true);
  });
});

describe('SEGMENT_FILTER.overstayed — a subset of inside, not a contradiction', () => {
  it('a visit that is overstaying also satisfies "inside" — both filters may legitimately select the same row', () => {
    const v = visit({
      status: 'checked_in',
      checked_in_at: '2026-08-01T03:00:00Z', // long past the 12h default threshold
    });
    expect(SEGMENT_FILTER.inside(v)).toBe(true);
    expect(SEGMENT_FILTER.overstayed(v)).toBe(true);
  });

  it('an ordinary recent check-in is inside but not overstayed', () => {
    const v = visit({ status: 'checked_in', checked_in_at: new Date().toISOString() });
    expect(SEGMENT_FILTER.inside(v)).toBe(true);
    expect(SEGMENT_FILTER.overstayed(v)).toBe(false);
  });
});

describe('segmentVisits — sorted by most recent activity first', () => {
  it('orders checked_in visits by their check-in time descending', () => {
    const older = visit({ id: 'older', status: 'checked_in', checked_in_at: '2026-08-11T02:00:00Z' });
    const newer = visit({ id: 'newer', status: 'checked_in', checked_in_at: '2026-08-11T05:00:00Z' });
    expect(segmentVisits([older, newer], 'inside').map((v) => v.id)).toEqual(['newer', 'older']);
  });

  it('falls back to checked_out_at, then scheduled_for, then created_at for the sort stamp', () => {
    const a = visit({ id: 'a', status: 'checked_out', checked_out_at: '2026-08-11T09:00:00Z', checked_in_at: '2026-08-11T01:00:00Z' });
    const b = visit({ id: 'b', status: 'checked_out', checked_out_at: '2026-08-11T08:00:00Z', checked_in_at: '2026-08-11T01:00:00Z' });
    expect(segmentVisits([b, a], 'checkedOut').map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('returns an empty array rather than throwing when nothing matches', () => {
    expect(segmentVisits([], 'inside')).toEqual([]);
    expect(segmentVisits([visit({ status: 'approved' })], 'checkedOut')).toEqual([]);
  });
});

describe('visitorLoadFilter — the query the page and the count hook must share', () => {
  it('bounds by created_at on the given day', () => {
    expect(visitorLoadFilter('2026-08-11')).toContain('created_at.gte.2026-08-11T00:00:00Z');
  });

  // Load-bearing: without "approved" in this list, the ordinary case (booked
  // yesterday, arriving today) never loads at all, because the row's created_at
  // is yesterday and it would otherwise fall outside the date-bounded half of
  // the filter entirely.
  it('ORs in every open status so an unfinished visit never falls out of the window at midnight', () => {
    const filter = visitorLoadFilter('2026-08-11');
    expect(filter).toContain('status.in.(pending_approval,approved,walkin_approved,checked_in)');
    OPEN_STATUSES.forEach((s) => expect(filter).toContain(s));
  });

  it('matches the exact OPEN_STATUSES list used to define "still open"', () => {
    expect(OPEN_STATUSES).toEqual(['pending_approval', 'approved', 'walkin_approved', 'checked_in']);
  });
});
