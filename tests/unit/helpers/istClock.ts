// Freezes the clock at a safe hour of the IST day, for suites whose fixtures
// are anchored to "today".
//
// Why this exists. Fixtures like checkInMatchesFixtures.todayIso() build a row
// at midday of the CURRENT IST day and rely on the code under test seeing it as
// due today. That is a race against the wall clock, and migration 075 moved the
// finish line: `istDayEnd` is now 22:00 IST, not midnight, so from 22:00 to
// 00:00 IST every such row is already expired and `isDueToday` returns false.
// The suite passed all day and failed for the two hours before midnight — which
// is exactly the failure the fixture's own comment warned about for the OLD
// midnight boundary, written before the boundary moved.
//
// Freezing only `Date` (`toFake: ['Date']`) is deliberate: setTimeout/interval
// stay real, so React Testing Library's waitFor and the components' own timers
// behave normally. Faking all timers here would hang every async assertion.
import { vi } from 'vitest';
import { istDayStart } from '../../../src/lib/visitExpiry';

/** Midday of the IST day the suite is running in — far from both the 00:00
 *  start and the 22:00 end, so neither boundary can be crossed mid-run. */
export function middayIst(now: Date = new Date()): Date {
  return new Date(istDayStart(now).getTime() + 12 * 3_600_000);
}

/** Call inside `beforeEach`. Pair with `unfreezeIstClock()` in `afterEach`. */
export function freezeIstClock(at: Date = middayIst()): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at);
}

export function unfreezeIstClock(): void {
  vi.useRealTimers();
}
