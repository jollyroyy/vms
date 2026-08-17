import React from 'react';
import AdminRangeBar from '../Admin/AdminRangeBar';
import { exportToCsv } from '../../lib/exportUtils';
import { toReportRows, type ReportVisit } from '../../lib/reportRow';
import type { RangePreset } from '../../lib/reportsDateRange';

type Props = {
  preset: RangePreset;
  date: string;
  today: string;
  onPresetChange: (preset: RangePreset) => void;
  onDateChange: (date: string) => void;
  /** The rows after the department filter — what leaves the building. */
  visits: ReportVisit[];
  filenameSuffix: string;
};

// The ADMIN's control row on /reports, replacing `ReportsToolbar` for that one
// role (client instruction, 2026-08-18: remove the "Date: … Selected Day / Last
// 7 Days / …" toolbar from admin Reports).
//
// The instruction is about the CONTROL, not about the window: a report with no
// period is not a report, and the charts, the four download bundles and the
// register below all read the same `from`/`to`. So what goes is the second
// spelling of one picker — `ReportsToolbar`'s "Date:" row was the shared page's
// own, while every other admin tab reaches for `AdminRangeBar`, which prints
// the RESOLVED dates as well as the lit preset. An admin now meets one range
// control across the whole console instead of two that look different and mean
// the same thing. An HOD and staff keep `ReportsToolbar` unchanged; they never
// see the admin console's bar, so for them there is nothing to unify with.
//
// The two buttons are the register's, and they moved here with the register
// itself when the Visitors Log tab was merged in. Both act on the FILTERED set
// and both say so in what they produce — the filename carries the department
// and the dates, the printed sheet carries them in its letterhead — because a
// CSV and a sheet of paper leave the building without the screen's pickers.
// Disabled at zero rather than emitting a header row with nothing under it: an
// empty file is indistinguishable from a broken export until somebody opens it.

export default function ReportsAdminBar({
  preset, date, today, onPresetChange, onDateChange, visits, filenameSuffix,
}: Props): React.ReactElement {
  return (
    <div className="no-print">
      <AdminRangeBar
        preset={preset}
        endDate={date}
        today={today}
        onPresetChange={onPresetChange}
        onEndDateChange={onDateChange}
        noun="visits"
      />

      <div className="flex flex-wrap items-center gap-2 -mt-2 mb-1">
        {/* Raw Visit rows must never reach the CSV: they carry nested join
            objects, the base64 photo blob and the visitor's unmasked phone.
            `toReportRows` is the redaction seam — see src/lib/reportRow.ts. */}
        <button
          type="button"
          disabled={visits.length === 0}
          onClick={() => exportToCsv(toReportRows(visits), `register-${filenameSuffix}.csv`)}
          className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>

        <button
          type="button"
          disabled={visits.length === 0}
          onClick={() => window.print()}
          className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-3 0h.008v.008h-.008V12z" />
          </svg>
          Print Register
        </button>
      </div>
    </div>
  );
}
