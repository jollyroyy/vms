import React from 'react';
import { exportToCsv } from '../../lib/exportUtils';
import { toReportRows, type ReportVisit } from '../../lib/reportRow';
import { RANGE_PRESETS, type RangePreset } from '../../lib/reportsDateRange';

type Props = {
  date: string;
  today: string;
  onDateChange: (date: string) => void;
  preset: RangePreset;
  onPresetChange: (preset: RangePreset) => void;
  visits: ReportVisit[];
  filenameSuffix: string;
};

export default function ReportsToolbar({ date, today, onDateChange, preset, onPresetChange, visits, filenameSuffix }: Props): React.ReactElement {
  return (
    <div className="card p-4 flex items-center gap-4 flex-wrap no-print">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-navy-600">Date:</label>
        <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} max={today} className="input w-auto" />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Report range">
        {RANGE_PRESETS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onPresetChange(key)}
            className={key === preset ? 'tab-active text-xs px-3 py-1.5' : 'tab-inactive text-xs px-3 py-1.5'}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Raw Visit rows must never reach the CSV: they carry nested join objects,
          the base64 photo blob and the visitor's unmasked phone. toReportRows is
          the redaction seam — see src/lib/reportRow.ts. */}
      <button onClick={() => exportToCsv(toReportRows(visits), `register-${filenameSuffix}.csv`)} className="btn-secondary text-sm flex items-center gap-2 ml-auto" title="Export CSV">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
        Export CSV
      </button>
      <button onClick={() => window.print()} className="btn-secondary text-sm flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-3 0h.008v.008h-.008V12z" /></svg>
        Print Register
      </button>
    </div>
  );
}
