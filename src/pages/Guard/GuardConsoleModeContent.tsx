import React from 'react';
import type { Visit } from '../../types/index';
import type { Mode } from './GuardConsoleModeTabs';
import GuardWalkIns from './GuardWalkIns';
import GuardWalkInApproved, { type WalkInCheckIn } from './GuardWalkInApproved';
import VisitorCard from './VisitorCard';
import { formatTime } from '../../lib/formatDate';

type Props = {
  mode: Mode;
  onCheckInSuccess: (name: string) => void;
  loading: boolean;
  checkedIn: Visit[];
  pendingWalkIns: Visit[];
  approvedWalkIns: Visit[];
  busyId: string | null;
  onCheckIn: (v: Visit, details: WalkInCheckIn) => void;
  onCheckOut: (v: Visit) => void;
};

type ListView = {
  title: string;
  empty: string;
  emptyHint: string;
  rows: (p: Props) => Visit[];
  timeOf: (v: Visit) => string;
  action?: (p: Props, v: Visit) => { label: string; onClick: () => void };
};

// One descriptor per list mode, looked up directly (kept as a lookup map even
// with a single entry — CLAUDE.md forbids collapsing this back into an
// if-chain). The audit list views (checked-out / rejected / all) were removed
// with the guard console decluttering; only "inside" remains here.
const LIST_VIEWS: Record<string, ListView> = {
  inside: {
    title: 'On the premises',
    empty: 'No one is inside right now.',
    emptyHint: 'Visitors you check in will appear here until they leave.',
    rows: (p) => p.checkedIn,
    timeOf: (v) => formatTime(v.checked_in_at ?? v.created_at),
    action: (p, v) => ({ label: 'Check Out', onClick: () => p.onCheckOut(v) }),
  },
};

export default function GuardConsoleModeContent(props: Props): React.ReactElement | null {
  const { mode, onCheckInSuccess, loading, pendingWalkIns } = props;

  if (mode === 'walkins') {
    return <GuardWalkIns loading={loading} pending={pendingWalkIns} onSubmitted={onCheckInSuccess} />;
  }

  // Not a LIST_VIEWS entry: this one captures a photo before it can act, so it
  // is a flow, not a row with a button.
  if (mode === 'walkinApproved') {
    return (
      <GuardWalkInApproved
        loading={loading}
        approved={props.approvedWalkIns}
        busyId={props.busyId}
        onCheckIn={props.onCheckIn}
      />
    );
  }

  const view = LIST_VIEWS[mode];
  if (!view) return null;
  const rows = view.rows(props);

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="gate-section-title">{view.title}</h2>
        <span className="glass-chip !py-1 tabular-nums">{rows.length}</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[68px] w-full rounded-2xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="card empty-state !py-14">
          <p className="text-sm font-semibold text-navy-500">{view.empty}</p>
          <p className="text-xs text-navy-400 mt-1">{view.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((v, i) => (
            <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
              <VisitorCard
                visit={v}
                timeLabel={view.timeOf(v)}
                action={view.action?.(props, v)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
