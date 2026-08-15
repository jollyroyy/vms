import { describe, it, expect } from 'vitest';
import {
  VISITOR_SEGMENTS, SEGMENT_SLUG, SEGMENT_META, SEGMENT_FILTER, OPEN_STATUSES,
  segmentPath, segmentFromSlug, segmentVisits, visitorLoadFilter,
} from '../../../src/lib/visitorSegments';
import type { ListSegment } from '../../../src/lib/visitorSegments';
import type { Visit } from '../../../src/types/index';

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
    // The Expected segment was removed 2026-08-15; `checkin` now degrades
    // onto All, same as `expected` and `checked-out`.
    expect(segmentFromSlug('checkin')).toBe('all');
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

// The Expected segment was removed on 2026-08-15 (client instruction), for
// the same reason `checkedOut` went: a visitor booked for today who has not
// arrived is the Pre-Registered tab's whole subject, and that board can act
// on them (it starts the check-in) where this display-only surface could not.
describe('there is no expected segment', () => {
  it('is absent from VISITOR_SEGMENTS, SEGMENT_FILTER and SEGMENT_META', () => {
    expect(VISITOR_SEGMENTS).not.toContain('expected' as never);
    expect(Object.keys(SEGMENT_FILTER)).not.toContain('expected');
    expect(Object.keys(SEGMENT_META)).not.toContain('expected');
  });

  // The URL and the legacy ?tab=checkin value both lived in bookmarks. They
  // degrade onto All, which still contains today's approved arrivals, rather
  // than 404-ing into a blank page.
  it('degrades the old /visitors/expected URL and the checkin alias onto All', () => {
    expect(segmentFromSlug('expected')).toBe('all');
    expect(segmentFromSlug('checkin')).toBe('all');
  });

  it('still lists an approved-not-yet-arrived visitor under All', () => {
    const v = visit({ status: 'approved', scheduled_for: '2026-08-11T10:00:00Z' });
    expect(SEGMENT_FILTER.all(v)).toBe(true);
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

  it('all matches everything regardless of status', () => {
    expect(SEGMENT_FILTER.all(visit({ status: 'rejected' }))).toBe(true);
    expect(SEGMENT_FILTER.all(visit({ status: 'checked_in' }))).toBe(true);
  });
});

// The Overstayed segment was removed on 2026-08-13 (client instruction). An
// overstay is a subset of Inside that needs chasing, and the guard dashboard's
// Overstaying tile is where that happens — `isOverstaying` is still live for
// it. This asserts the segment is gone from every list that defines the
// surface, so it cannot come back on one of them alone.
describe('there is no overstayed segment', () => {
  it('is absent from VISITOR_SEGMENTS and SEGMENT_FILTER', () => {
    expect(VISITOR_SEGMENTS).not.toContain('overstayed' as never);
    expect(Object.keys(SEGMENT_FILTER)).not.toContain('overstayed');
    expect(Object.keys(SEGMENT_META)).not.toContain('overstayed');
  });

  // The URL lived in bookmarks. It must land on the list it was reaching for,
  // never on a blank page.
  it('degrades the old /visitors/overstayed URL onto Inside', () => {
    expect(segmentFromSlug('overstayed')).toBe('inside');
  });

  it('still lists an overstaying visitor under Inside', () => {
    const v = visit({ status: 'checked_in', checked_in_at: '2026-08-01T03:00:00Z' });
    expect(SEGMENT_FILTER.inside(v)).toBe(true);
  });
});

describe('segmentVisits — sorted by most recent activity first', () => {
  it('orders checked_in visits by their check-in time descending', () => {
    const older = visit({ id: 'older', status: 'checked_in', checked_in_at: '2026-08-11T02:00:00Z' });
    const newer = visit({ id: 'newer', status: 'checked_in', checked_in_at: '2026-08-11T05:00:00Z' });
    expect(segmentVisits([older, newer], 'inside').map((v) => v.id)).toEqual(['newer', 'older']);
  });

  // No segment lists checked_out rows anymore (removed 2026-08-15), but the
  // stamp fallback itself is segment-agnostic — exercise it through `all`,
  // which still matches every status.
  it('falls back to checked_out_at, then scheduled_for, then created_at for the sort stamp', () => {
    const a = visit({ id: 'a', status: 'checked_out', checked_out_at: '2026-08-11T09:00:00Z', checked_in_at: '2026-08-11T01:00:00Z' });
    const b = visit({ id: 'b', status: 'checked_out', checked_out_at: '2026-08-11T08:00:00Z', checked_in_at: '2026-08-11T01:00:00Z' });
    expect(segmentVisits([b, a], 'all').map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('returns an empty array rather than throwing when nothing matches', () => {
    expect(segmentVisits([], 'inside')).toEqual([]);
    expect(segmentVisits([visit({ status: 'checked_out' })], 'pending')).toEqual([]);
  });
});

// The Checked Out segment was removed on 2026-08-15 (client instruction). A
// visitor who has left is the Entry & Exit tab's subject now, not a Visitors
// list segment.
describe('there is no checkedOut segment', () => {
  it('is absent from VISITOR_SEGMENTS, SEGMENT_FILTER and SEGMENT_META', () => {
    expect(VISITOR_SEGMENTS).not.toContain('checkedOut' as never);
    expect(Object.keys(SEGMENT_FILTER)).not.toContain('checkedOut');
    expect(Object.keys(SEGMENT_META)).not.toContain('checkedOut');
  });

  // The URL lived in bookmarks. It degrades onto All, which still contains
  // today's departures, rather than 404-ing into a blank page.
  it('degrades the old /visitors/checked-out URL onto All', () => {
    expect(segmentFromSlug('checked-out')).toBe('all');
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
