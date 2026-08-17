import React from 'react';
import type { ReportVisit } from '../../lib/reportRow';
import DashboardPanel from '../../components/DashboardPanel';
import DashboardVisitorTable from '../../components/DashboardVisitorTable';
import { COLUMN } from '../../lib/dashboardColumns';
import { initialsOf } from '../../lib/initials';
import { ICON_X_CIRCLE } from '../../lib/tileIcons';

type Props = { rows: ReportVisit[]; loading: boolean; now: Date; onOpen: (v: ReportVisit) => void };

// Every visit refused in the selected date range — by an HOD declining a
// walk-in request, or by a guard refusing entry at the gate. Both land on
// `status === 'rejected'`, and this table is where they MUST stay
// distinguishable (CLAUDE.md's `Declined` tile note): the heading names
// neither actor, but `COLUMN.decidedBy` prints "<name> (<role>)" resolved
// from the `visit_rejected` audit row via lib/visitActors.ts, so a guard's
// refusal and an HOD's decline read differently row by row rather than being
// flattened into one "entry denied" label. `COLUMN.reason` is the
// justification either desk was required to give — mandatory on a guard's
// refusal, whatever an HOD typed on theirs.
//
// "Denied Entries", not "Denied Entries Today" — this list follows the
// `AdminRangeBar` above it now (lib/adminSecurity.ts's `deniedEntries`), so
// the old heading would claim a window this panel no longer promises. The
// range is stated once, on the bar itself; repeating it in every ranged
// panel's own heading would be the same fact printed twice on one screen.
export default function AdminDeniedEntriesPanel({ rows, loading, now, onOpen }: Props): React.ReactElement {
  return (
    <DashboardPanel icon={ICON_X_CIRCLE} heading="Denied Entries" count={rows.length} loading={loading}>
      <DashboardVisitorTable
        rows={rows}
        columns={[COLUMN.name, COLUMN.host, COLUMN.department, COLUMN.decidedBy, COLUMN.reason]}
        loading={loading}
        empty="No entry was denied in this window."
        now={now}
        initialsOf={initialsOf}
        onOpen={onOpen}
      />
    </DashboardPanel>
  );
}
