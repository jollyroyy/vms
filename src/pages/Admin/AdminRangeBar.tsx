import React from 'react';
import { RANGE_PRESETS, computeDateRange, rangeLabel, type RangePreset } from '../../lib/reportsDateRange';

// The date-range control every historical admin tab carries (client
// instruction, 2026-08-17): pick a day, then pick how far back from it to
// reach — 7 / 30 / 60 / 90 days or a year.
//
// IT IS ITS OWN ROW, NOT A HEADER ACTION. Six preset buttons plus a date input
// is wider than a title's trailing edge can hold, and `AdminPageHeader`'s
// action slot is `shrink-0` — dropping this in there would push the controls
// off the right of the page at any window narrower than a desktop, which is
// exactly the overflow class of defect this console was just cleaned of. As its
// own `flex-wrap` row it reflows instead.
//
// THE RESOLVED PERIOD IS PRINTED, not just the button state. Which preset is
// lit tells an admin what they clicked; the dates tell them what they got, and
// those are different facts — a "Last 90 Days" pill above a table says nothing
// about whether the visit they are hunting for is inside the window.
//
// The picker is presentational: it owns no range. The page holds `preset` and
// `endDate` and derives its window with `computeDateRange`, so the fetch, the
// figures and this label all read from one pair of values.

type Props = {
  preset: RangePreset;
  endDate: string;
  /** Today's IST date key — the latest day that can be selected. A range whose
   *  end is in the future would silently report an empty tail as "no visits". */
  today: string;
  onPresetChange: (preset: RangePreset) => void;
  onEndDateChange: (date: string) => void;
  /** Name of what is being ranged, e.g. "bookings". Used in the printed
   *  period line so it reads as a statement rather than a floating date. */
  noun: string;
};

export default function AdminRangeBar({
  preset, endDate, today, onPresetChange, onEndDateChange, noun,
}: Props): React.ReactElement {
  const range = computeDateRange(preset, endDate);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-5">
      <div className="flex items-center gap-2 min-w-0">
        <label htmlFor="admin-range-end" className="text-sm font-medium text-navy-700 shrink-0">
          Up to
        </label>
        <input
          id="admin-range-end"
          type="date"
          value={endDate}
          max={today}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="input w-auto min-w-0"
        />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Date range">
        {RANGE_PRESETS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={key === preset}
            onClick={() => onPresetChange(key)}
            className={`${key === preset ? 'tab-active' : 'tab-inactive'} text-xs px-3 py-1.5 whitespace-nowrap`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs text-navy-600 basis-full sm:basis-auto sm:ml-auto">
        Showing {noun} from <span className="font-semibold text-navy-800">{rangeLabel(preset, range)}</span>
      </p>
    </div>
  );
}
