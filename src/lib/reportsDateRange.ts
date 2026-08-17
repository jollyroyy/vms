// The one date-range vocabulary in the app.
//
// Reports had its own set (Today / 7 / 30 / 3 Months / 1 Year) and the admin
// console's historical tabs had none at all. Two different range controls in
// one console means an admin learns the control twice and, worse, that "last
// 30 days" on one screen and "last 3 months" on another cannot be lined up
// against each other without arithmetic. There is one set of words now, used by
// Reports and by every ranged admin tab (client instruction, 2026-08-17:
// date-wise plus 7 / 30 / 60 / 90 days and one year).
//
// `3m` WAS REPLACED BY `60d` AND `90d`, not joined by them. A calendar month is
// a different length depending on which one you are standing in, so "last 3
// months" is not comparable with itself across the year, while 90 days always
// is. Nothing persists a preset — Reports holds it in component state and no
// URL carries it — so there is no stored `3m` to degrade.
//
// THE SPAN IS RELATIVE TO A CHOSEN END DATE, never hardcoded to today. That is
// what makes the "date-wise" half of the instruction work: pick the day, then
// pick how far back from it to reach. `today` is therefore a single-day span on
// whichever date is selected, which is why it is labelled "Selected Day" and
// not "Today" — the old label was a lie the moment an admin picked another date.

export type RangePreset = 'today' | '7d' | '30d' | '60d' | '90d' | '1y';

export const RANGE_PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'Selected Day' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '60d', label: 'Last 60 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: '1y', label: 'Last 1 Year' },
];

export type DateRange = { from: string; to: string };

/**
 * The inclusive `YYYY-MM-DD` range a preset covers, counting back from
 * `endDate`.
 *
 * The day spans subtract `n - 1`, so "Last 7 Days" is seven days INCLUDING the
 * end date rather than eight. The calendar-year span subtracts a year outright:
 * a year is a named boundary an admin can check against a calendar, where 364
 * days is not.
 */
export function computeDateRange(preset: RangePreset, endDate: string): DateRange {
  const end = new Date(`${endDate}T00:00:00Z`);
  const from = new Date(end);
  switch (preset) {
    case 'today': break;
    case '7d': from.setUTCDate(from.getUTCDate() - 6); break;
    case '30d': from.setUTCDate(from.getUTCDate() - 29); break;
    case '60d': from.setUTCDate(from.getUTCDate() - 59); break;
    case '90d': from.setUTCDate(from.getUTCDate() - 89); break;
    case '1y': from.setUTCFullYear(from.getUTCFullYear() - 1); break;
  }
  return { from: from.toISOString().slice(0, 10), to: endDate };
}

/**
 * The instants an inclusive IST date range covers: `[from, to)`.
 *
 * A `YYYY-MM-DD` here is a CALENDAR DAY IN IST, not a UTC one, so its bounds
 * are `T00:00:00+05:30` — never `T00:00:00Z`, which is 05:30 IST and drops
 * every arrival made between midnight and dawn on the first day of the range.
 *
 * The upper bound is the start of the day AFTER `to` and the caller compares
 * with `<`, rather than a `<=` on 23:59:59: a second-precision ceiling loses
 * the final second of the range, and at a busy gate that is a real visit that
 * an admin is then told never happened.
 */
export function rangeBounds(range: DateRange): { from: string; to: string } {
  const startOfTo = new Date(`${range.to}T00:00:00+05:30`).getTime();
  return {
    from: new Date(`${range.from}T00:00:00+05:30`).toISOString(),
    to: new Date(startOfTo + 86400000).toISOString(),
  };
}

const DAY_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

function formatDay(dayKey: string): string {
  // Parsed as a UTC instant and formatted in UTC. A date-only key is a
  // calendar day, not a moment, so reading it in the browser's zone would
  // print the previous day for anyone west of Greenwich — the same class of
  // error `istDateKey` exists to prevent elsewhere.
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString('en-GB', { ...DAY_FORMAT, timeZone: 'UTC' });
}

/**
 * The period, in words, for a page to print beside its title.
 *
 * EVERY RANGED SCREEN MUST STATE ITS WINDOW. A table of past visits with no
 * period on screen is the same defect as the Visitors Log's silent 500-row cap:
 * an admin who searches for someone and finds nothing concludes the visit never
 * happened, when the truth is that it fell outside a window nobody told them
 * about. The preset's own label is included as well as the dates, because the
 * label is what they clicked and the dates are what they got.
 */
export function rangeLabel(preset: RangePreset, range: DateRange): string {
  const spanned = RANGE_PRESETS.find((p) => p.key === preset)?.label ?? '';
  if (range.from === range.to) return formatDay(range.to);
  return `${formatDay(range.from)} – ${formatDay(range.to)} · ${spanned.toLowerCase()}`;
}
