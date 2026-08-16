// The HOD's ONE decision desk: walk-in requests raised at the gate.
//
// It was one of two (client instruction, 2026-08-16 — "remove approval desk
// from hod view"). The other, the scheduled pre-approval desk at
// `/overview?tab=preapprovals`, listed `pending_approval` rows carrying a
// `scheduled_for`, and no such row can exist: WalkInRequest and the kiosk are
// the only two writers of that status and both insert `scheduled_for: null`,
// while a pre-approval is created already approved and never passes through it.
// The desk could therefore never hold a row, and every decision an HOD actually
// makes has always landed here.
//
// The list is the shared components/DashboardVisitorTable, with the same
// columns the guard's Pending Walk-in Approvals panel uses — clicking a row
// selects it for the decision panel beside it, which is the one thing this
// surface does that the guard's read-only board does not.
import React from 'react';
import type { Visit } from '../../types/index';
import type { ReportVisit } from '../../lib/reportRow';
import { HOD_PANEL_SPEC } from '../../lib/hodTiles';
import { ICON_WALKING } from '../../lib/tileIcons';
import DashboardPanel from '../../components/DashboardPanel';
import DashboardVisitorTable from '../../components/DashboardVisitorTable';
import HodDecisionPanel from './HodDecisionPanel';

type Props = {
  walkIns: Visit[];
  loading: boolean;
  now: Date;
  initialsOf: (name: string | null | undefined) => string;
  selected: Visit | null;
  onSelect: (id: string) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  acting: boolean;
  onDecide: (approved: boolean) => void;
};

export default function HodWalkInDesk({
  walkIns, loading, now, initialsOf, selected, onSelect,
  reason, onReasonChange, acting, onDecide,
}: Props): React.ReactElement {
  const spec = HOD_PANEL_SPEC.pending;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)]">
      <DashboardPanel
        icon={ICON_WALKING}
        heading="Arrivals Waiting For You"
        count={walkIns.length}
        loading={loading}>
        <DashboardVisitorTable
          rows={walkIns as ReportVisit[]}
          columns={spec.columns}
          loading={loading}
          empty={spec.empty}
          now={now}
          initialsOf={initialsOf}
          onOpen={(visit) => onSelect(visit.id)}
        />
      </DashboardPanel>

      <HodDecisionPanel
        visit={selected}
        reason={reason}
        onReasonChange={onReasonChange}
        acting={acting}
        onDecide={onDecide}
      />
    </div>
  );
}
