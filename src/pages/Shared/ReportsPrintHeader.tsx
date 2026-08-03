/**
 * Letterhead shown only in the printed register (see .print-only in
 * src/styles/base.css and the print rules in src/styles/print.css).
 * Logo top-left, title/sub-heading/meta beside it, generated-on
 * timestamp + entry count right-aligned opposite — separated from the
 * table by a single hairline rule.
 */
import React from 'react';

type Props = {
  rangeLabel: string;
  entryCount: number;
};

export default function ReportsPrintHeader({ rangeLabel, entryCount }: Props): React.ReactElement {
  const generatedAt = new Date();

  return (
    <div className="print-header">
      <div className="print-header-left">
        <img src="/quest-mall-logo.jpg" alt="Quest Mall" width={193} height={160} className="print-logo" />
        <div className="print-header-text">
          <h1 className="print-title">Visitor Register</h1>
          <p className="print-subtitle">{rangeLabel}</p>
          <p className="print-meta">Secure Gate · Visitor Management System</p>
        </div>
      </div>
      <div className="print-header-right">
        <p className="print-meta">Generated {generatedAt.toLocaleDateString('en-IN')} {generatedAt.toLocaleTimeString('en-IN')}</p>
        <p className="print-meta">{entryCount} {entryCount === 1 ? 'entry' : 'entries'}</p>
      </div>
    </div>
  );
}
