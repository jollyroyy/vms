// Approved and expected visits for this department — read-only.
//
// Same card, same table, same type as the guard's dashboard panels (client
// instruction, 2026-08-16). The rows sort ASCENDING, soonest first: a list of
// people still to arrive is read forwards, which is the rule the guard's
// Expected Today panel already follows.
import React from 'react';
import type { Visit } from '../../types/index';
import type { ReportVisit } from '../../lib/reportRow';
import { COLUMN } from '../../lib/dashboardColumns';
import { ICON_CALENDAR } from '../../lib/tileIcons';
import DashboardPanel from '../../components/DashboardPanel';
import DashboardVisitorTable from '../../components/DashboardVisitorTable';

// No Department column: an HOD belongs to exactly one department, so it would
// print the same value on every line. The slot is the whole subject here.
const SCHEDULE_COLUMNS = [COLUMN.name, COLUMN.purpose, COLUMN.host, COLUMN.scheduled, COLUMN.status];

type Props = {
  visits: Visit[];
  onSiteCount: number;
  approvedTodayCount: number;
  loading: boolean;
  now: Date;
  initialsOf: (name: string | null | undefined) => string;
  onOpen: (visit: ReportVisit) => void;
};

function GlanceRow({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-200/50 dark:border-white/[0.05] last:border-0">
      <span className="text-sm text-[#9aa3af] dark:text-[#b7c0cb]">{label}</span>
      <span className="font-display text-lg tabular-nums text-navy-950 dark:text-white">{value}</span>
    </div>
  );
}

export default function HodSchedule({
  visits, onSiteCount, approvedTodayCount, loading, now, initialsOf, onOpen,
}: Props): React.ReactElement {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)]">
      <DashboardPanel icon={ICON_CALENDAR} heading="Visitor Schedule" count={visits.length} loading={loading}>
        <DashboardVisitorTable
          rows={visits as ReportVisit[]}
          columns={SCHEDULE_COLUMNS}
          loading={loading}
          empty="No approved appointments are scheduled in the current horizon."
          now={now}
          initialsOf={initialsOf}
          onOpen={onOpen}
        />
      </DashboardPanel>

      <aside className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm self-start">
        <p className="text-[11px] uppercase tracking-wider text-navy-500 dark:text-navy-400 font-semibold mb-2">
          Today at a glance
        </p>
        <GlanceRow label="Approved appointments" value={approvedTodayCount} />
        <GlanceRow label="On site now" value={onSiteCount} />
        <p className="text-xs text-[#9aa3af] dark:text-[#b7c0cb] mt-3 leading-relaxed">
          The schedule is read-only. Decisions are made on the walk-in desk.
        </p>
      </aside>
    </div>
  );
}
