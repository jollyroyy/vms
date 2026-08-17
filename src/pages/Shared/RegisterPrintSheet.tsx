import React from 'react';
import ReportsPrintHeader from './ReportsPrintHeader';
import RegisterTable from './RegisterTable';
import type { ReportVisit } from '../../lib/reportRow';

type Props = {
  /** The FILTERED rows — whatever the screen is showing, not everything loaded. */
  rows: ReportVisit[];
  /** Names the window and any department filter, e.g. "Engineering · 11 Aug to 17 Aug". */
  rangeLabel: string;
};

// The paper artefact, with no screen half.
//
// It exists because the admin's register moved to the Visitors Log tab
// (2026-08-17, client instruction) and that tab reads its rows through
// `DashboardVisitorTable` — eight columns, a row that opens a record — which is
// the right shape for looking somebody up and the wrong shape for a signed
// document. So the tab renders THIS in a `print-only` block: the letterhead, the
// same seventeen-column `RegisterTable` the HOD's register prints, and the
// end-of-report block with somewhere to sign.
//
// EVERY ROW IT IS GIVEN IS PRINTED — there is no pagination here, deliberately.
// The screen pages at 25 rows so a reader is not handed 500 at once; a printed
// register that silently stopped at whatever page happened to be open would be a
// document claiming to be the window named in its own letterhead while holding a
// twentieth of it. The caller passes the filtered set, not the page.
//
// It is NOT wrapped in `.print-only` itself: the class must sit on the caller's
// element so the block is display-none on screen at the top of the tree, rather
// than each child having to opt out.

export default function RegisterPrintSheet({ rows, rangeLabel }: Props): React.ReactElement {
  return (
    <>
      <ReportsPrintHeader rangeLabel={`Register — ${rangeLabel}`} entryCount={rows.length} />

      <div className="overflow-x-auto">
        <RegisterTable rows={rows} />
      </div>

      <div className="print-footer">
        <p className="print-meta">
          End of register · {rows.length} {rows.length === 1 ? 'entry' : 'entries'} · {rangeLabel}
        </p>
        <p className="print-meta">Confidential — contains personal data. Phone and ID numbers are masked.</p>
        <div className="print-signature"><span className="print-meta">Verified by</span></div>
      </div>
    </>
  );
}
