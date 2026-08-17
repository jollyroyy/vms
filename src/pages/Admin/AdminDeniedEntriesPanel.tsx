import React from 'react';
import type { ReportVisit } from '../../lib/reportRow';
import DashboardPanel from '../../components/DashboardPanel';
import DashboardVisitorTable from '../../components/DashboardVisitorTable';
import { COLUMN } from '../../lib/dashboardColumns';
import { initialsOf } from '../../lib/initials';
import { ICON_X_CIRCLE } from '../../lib/tileIcons';

type Props = { rows: ReportVisit[]; loading: boolean; now: Date; onOpen: (v: ReportVisit) => void };

// Every visit refused today — by an HOD declining a walk-in request, or by a
// guard refusing entry at the gate. Both land on `status === 'rejected'`, and
// this table is where they MUST stay distinguishable (CLAUDE.md's `Declined`
// tile note): the heading names neither actor, but `COLUMN.decidedBy` prints
// "<name> (<role>)" resolved from the `visit_rejected` audit row via
// lib/visitActors.ts, so a guard's refusal and an HOD's decline read
// differently row by row rather than being flattened into one "entry denied"
// label. `COLUMN.reason` is the justification either desk was required to
// give — mandatory on a guard's refusal, whatever an HOD typed on theirs.
export default function AdminDeniedEntriesPanel({ rows, loading, now, onOpen }: Props): React.ReactElement {
  return (
    <DashboardPanel icon={ICON_X_CIRCLE} heading="Denied Entries Today" count={rows.length} loading={loading}>
      <DashboardVisitorTable
        rows={rows}
        columns={[COLUMN.name, COLUMN.host, COLUMN.department, COLUMN.decidedBy, COLUMN.reason]}
        loading={loading}
        empty="No entry was denied today."
        now={now}
        initialsOf={initialsOf}
        onOpen={onOpen}
      />
    </DashboardPanel>
  );
}
