// The admin dashboard's six figures (src/lib/adminDashboard.ts), pure over an
// array of visits — same discipline as guardTiles.test.ts: a count and its
// backing rows must come from one predicate, so every case here pins both.
import { describe, it, expect } from 'vitest';
import {
  arrivedOn, adminKpis, hourlyFlow, purposeSplit, topHosts, lobbyFeed,
} from '../../../src/lib/adminDashboard';
import type { Visit, VisitFeedback } from '../../../src/types/index';

function v(over: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    ref_number: 'VIS-1',
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
    scheduled_for: '2026-08-14T04:00:00Z',
    qr_token: 'tok',
    qr_expires_at: null,
    created_at: '2026-08-14T02:00:00Z',
    ...over,
  } as unknown as Visit;
}

function f(over: Partial<VisitFeedback> = {}): VisitFeedback {
  return { id: 'f1', visit_id: 'v1', rating: 5, comment: null, created_at: '2026-08-14T02:00:00Z', ...over };
}

// 2026-08-14T12:00:00Z = 17:30 IST, matching guardTiles.test.ts's NOW.
const NOW = new Date('2026-08-14T12:00:00Z');

describe('arrivedOn', () => {
  it('does NOT count a visit created today but never checked in', () => {
    // `created_at` is not the rule. A pre-approval or a raised request that has
    // not reached the gate is not a visitor today.
    expect(arrivedOn(v({ created_at: '2026-08-14T01:00:00Z', checked_in_at: null }), '2026-08-14')).toBe(false);
  });

  it('DOES count a visit created weeks ago but checked in today', () => {
    expect(arrivedOn(
      v({ created_at: '2026-07-01T01:00:00Z', checked_in_at: '2026-08-14T09:00:00Z' }),
      '2026-08-14',
    )).toBe(true);
  });

  // 2026-08-13T20:00:00Z is 01:30 IST on the 14th. A UTC-dated read would file
  // this under the 13th and the tile would silently drop an early-morning arrival.
  it('files a 00:00-05:30 IST arrival under the correct IST day, not the UTC one', () => {
    expect(arrivedOn(v({ checked_in_at: '2026-08-13T20:00:00Z' }), '2026-08-14')).toBe(true);
    expect(arrivedOn(v({ checked_in_at: '2026-08-13T20:00:00Z' }), '2026-08-13')).toBe(false);
  });
});

describe('adminKpis', () => {
  // NO YESTERDAY COMPARISON (client instruction, 2026-08-18: it was clutter on
  // the tile). `visitorsYesterday` and `changeVsYesterday` are gone from
  // `AdminKpis` entirely rather than left computed-but-unread — a figure no
  // screen may print is how the comparison comes back. `visitorsToday` counts
  // TODAY only, and yesterday's arrivals in the same array must not touch it,
  // which is what the two-day fetch makes possible to get wrong.
  it('counts only today into visitorsToday, ignoring yesterday in the same fetch', () => {
    const visits = [
      v({ id: 'a', checked_in_at: '2026-08-14T09:00:00Z' }),
      v({ id: 'b', checked_in_at: '2026-08-14T10:00:00Z' }),
      v({ id: 'y', checked_in_at: '2026-08-13T09:00:00Z' }),
    ];
    const kpis = adminKpis(visits, [], NOW);
    expect(kpis.visitorsToday).toBe(2);
    expect(kpis).not.toHaveProperty('changeVsYesterday');
    expect(kpis).not.toHaveProperty('visitorsYesterday');
  });

  it('reads avgCheckinSeconds as null when nothing was measured', () => {
    const visits = [v({ checked_in_at: '2026-08-14T09:00:00Z', checkin_duration_seconds: null })];
    const k = adminKpis(visits, [], NOW);
    expect(k.avgCheckinSeconds).toBeNull();
    expect(k.avgCheckinSampleSize).toBe(0);
  });

  it('averages only the measured arrivals, ignoring null/zero durations', () => {
    const visits = [
      v({ id: 'a', checked_in_at: '2026-08-14T09:00:00Z', checkin_duration_seconds: 40 }),
      v({ id: 'b', checked_in_at: '2026-08-14T09:00:00Z', checkin_duration_seconds: 60 }),
      v({ id: 'c', checked_in_at: '2026-08-14T09:00:00Z', checkin_duration_seconds: null }),
    ];
    const k = adminKpis(visits, [], NOW);
    expect(k.avgCheckinSeconds).toBe(50);
    expect(k.avgCheckinSampleSize).toBe(2);
  });

  it('reads satisfaction as null with no ratings, and rounds to one decimal', () => {
    expect(adminKpis([], [], NOW).satisfaction).toBeNull();
    const k = adminKpis([], [f({ rating: 4 }), f({ rating: 5 })], NOW);
    expect(k.satisfaction).toBe(4.5);
    expect(k.reviewCount).toBe(2);
  });

  it('drops an out-of-range rating rather than let it skew the mean', () => {
    const k = adminKpis([], [f({ rating: 5 }), f({ rating: 0 as never })], NOW);
    expect(k.reviewCount).toBe(1);
  });

  it('counts currentlyInside on status === checked_in ONLY, never widened', () => {
    // A host-cleared walk-in (`walkin_approved`) has not come through the gate
    // since migration 083 reverted the same-click admission — including it
    // here would put someone still standing outside on the fire-marshal figure.
    const visits = [
      v({ id: 'inside', status: 'checked_in', checked_in_at: '2026-08-14T09:00:00Z' }),
      v({ id: 'cleared', status: 'walkin_approved', scheduled_for: null }),
      v({ id: 'left', status: 'checked_out', checked_in_at: '2026-08-14T05:00:00Z', checked_out_at: '2026-08-14T06:00:00Z' }),
    ];
    expect(adminKpis(visits, [], NOW).currentlyInside).toBe(1);
  });

  it('sums preRegistered + walkIn to visitorsToday', () => {
    const visits = [
      v({ id: 'a', status: 'checked_in', checked_in_at: '2026-08-14T09:00:00Z', scheduled_for: '2026-08-14T09:00:00Z' }),
      v({ id: 'b', status: 'checked_in', checked_in_at: '2026-08-14T10:00:00Z', scheduled_for: null }),
      v({ id: 'c', status: 'checked_out', checked_in_at: '2026-08-14T08:00:00Z', checked_out_at: '2026-08-14T09:00:00Z', scheduled_for: null }),
    ];
    const k = adminKpis(visits, [], NOW);
    expect(k.preRegistered + k.walkIn).toBe(k.visitorsToday);
    expect(k.visitorsToday).toBe(3);
  });

  it('counts overstays as inside AND past the deadline, never inside alone', () => {
    const visits = [
      v({ id: 'over', status: 'checked_in', checked_in_at: '2026-08-13T20:00:00Z' }), // well past 12h
      v({ id: 'fresh', status: 'checked_in', checked_in_at: '2026-08-14T11:00:00Z' }),
    ];
    expect(adminKpis(visits, [], NOW).overstays).toBe(1);
  });
});

describe('hourlyFlow', () => {
  it('carries every hour in the window even at zero — a gap is not a quiet hour', () => {
    const buckets = hourlyFlow([], NOW);
    expect(buckets.map((b) => b.label)).toEqual([
      '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
    ]);
    expect(buckets.every((b) => b.value === 0)).toBe(true);
  });

  it('clamps an early arrival into the first bucket rather than dropping it', () => {
    // 2026-08-14T00:30:00Z = 06:00 IST — before the 08:00 window opens.
    const visits = [v({ checked_in_at: '2026-08-14T00:30:00Z' })];
    const buckets = hourlyFlow(visits, NOW);
    expect(buckets.find((b) => b.label === '08:00')?.value).toBe(1);
  });

  it('clamps a late arrival into the last bucket rather than dropping it', () => {
    // 2026-08-14T15:00:00Z = 20:30 IST — after the 18:00 window closes.
    const visits = [v({ checked_in_at: '2026-08-14T15:00:00Z' })];
    const buckets = hourlyFlow(visits, NOW);
    expect(buckets.find((b) => b.label === '18:00')?.value).toBe(1);
  });

  it('sums to the day’s total arrivals — clamping must never lose a visitor', () => {
    const visits = [
      v({ id: 'a', checked_in_at: '2026-08-14T00:30:00Z' }), // clamps to 08:00
      v({ id: 'b', checked_in_at: '2026-08-14T15:00:00Z' }), // clamps to 18:00
      v({ id: 'c', checked_in_at: '2026-08-14T06:30:00Z' }), // 12:00 IST, in-window
    ];
    const buckets = hourlyFlow(visits, NOW);
    expect(buckets.reduce((sum, b) => sum + b.value, 0)).toBe(3);
  });
});

describe('purposeSplit', () => {
  it('drops zero-count purposes and sorts largest first', () => {
    const visits = [
      v({ id: 'a', purpose: 'vendor', checked_in_at: '2026-08-14T09:00:00Z' }),
      v({ id: 'b', purpose: 'meeting', checked_in_at: '2026-08-14T09:00:00Z' }),
      v({ id: 'c', purpose: 'meeting', checked_in_at: '2026-08-14T09:00:00Z' }),
    ];
    expect(purposeSplit(visits, NOW)).toEqual([
      { label: 'Meetings', value: 2 },
      { label: 'Vendors', value: 1 },
    ]);
  });
});

describe('topHosts', () => {
  it('names a host who failed to join rather than dropping their visitor', () => {
    const visits = [v({ host_id: 'ghost', host: undefined, checked_in_at: '2026-08-14T09:00:00Z' })];
    expect(topHosts(visits, NOW)).toEqual([
      // `avatarUrl` is null rather than absent: a host the join could not
      // resolve has no photo to offer, and the card must render its monogram
      // rather than a broken image.
      { hostId: 'ghost', label: 'Unassigned host', value: 1, avatarUrl: null },
    ]);
  });

  it('ranks by count, then breaks ties alphabetically', () => {
    const visits = [
      v({ id: 'a', host_id: 'h1', host: { id: 'h1', full_name: 'Zed' }, checked_in_at: '2026-08-14T09:00:00Z' }),
      v({ id: 'b', host_id: 'h2', host: { id: 'h2', full_name: 'Amy' }, checked_in_at: '2026-08-14T09:00:00Z' }),
    ];
    expect(topHosts(visits, NOW).map((h) => h.label)).toEqual(['Amy', 'Zed']);
  });
});

describe('lobbyFeed', () => {
  it('orders most recent arrival first and respects the limit', () => {
    const visits = [
      v({ id: 'early', checked_in_at: '2026-08-14T05:00:00Z' }),
      v({ id: 'late', checked_in_at: '2026-08-14T09:00:00Z' }),
    ];
    expect(lobbyFeed(visits, NOW, 1).map((x) => x.id)).toEqual(['late']);
  });
});
