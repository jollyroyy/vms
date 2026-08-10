// The HOD's decision surface, on the Overview itself.
//
// These are walk-in requests: a visitor turned up at the gate unannounced, the
// guard raised a request, and the visit sits at `pending_approval` until this
// department's HOD approves or rejects it. Someone is standing at reception
// while it is open, which is why the full details are on the page rather than
// behind a tile click — and why this section renders above everything else.
// Pre-approvals never appear here; they are created already approved.
import React, { useState } from 'react';
import type { Visit } from '../../types/index';
import ApprovalsPendingList from './ApprovalsPendingList';
import VisitorDetails from '../../components/VisitorDetails';

type Props = {
  visits: Visit[];
  loading: boolean;
  acting: string | null;
  reasons: Record<string, string>;
  onReasonChange: (id: string, value: string) => void;
  onDecide: (id: string, approved: boolean) => void;
};

export default function OverviewPendingApprovals({
  visits, loading, acting, reasons, onReasonChange, onDecide,
}: Props): React.ReactElement | null {
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);

  // Nothing waiting is the normal state — an empty "all caught up" panel every
  // time would push the day's actual activity below the fold for no reason.
  if (!loading && visits.length === 0) return null;

  return (
    <section className="animate-fade-in space-y-3">
      {detailVisit && (
        <VisitorDetails
          visit={detailVisit}
          // /overview is HOD-only in ROLE_ROUTES, so the role can be stated —
          // the pass gate fails closed on an unknown viewer.
          viewerRole="hod"
          onClose={() => setDetailVisit(null)}
          acting={acting}
          reason={reasons[detailVisit.id] ?? ''}
          onReasonChange={(val) => onReasonChange(detailVisit.id, val)}
          onApprove={() => { onDecide(detailVisit.id, true); setDetailVisit(null); }}
          onReject={() => { onDecide(detailVisit.id, false); setDetailVisit(null); }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">Pending Walk-in Approvals</h2>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-0.5">Visitors waiting at the gate for your decision</p>
        </div>
        {!loading && (
          <span className="text-[11px] font-bold text-white bg-gradient-to-r from-brand-500 to-accent-500 px-3 py-1.5 rounded-full shadow-glow-sm">
            {visits.length} waiting
          </span>
        )}
      </div>

      <ApprovalsPendingList
        visits={visits}
        loading={loading}
        error=""
        acting={acting}
        reasons={reasons}
        onReasonChange={onReasonChange}
        onDecide={onDecide}
        onViewDetails={setDetailVisit}
      />
    </section>
  );
}
