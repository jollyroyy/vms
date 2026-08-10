import React, { useState } from 'react';
import type { Visit } from '../../types/index';
import VisitorCard from './VisitorCard';
import WalkInRequest from './WalkInRequest';
import { formatTime } from '../../lib/formatDate';

type Props = {
  loading: boolean;
  /** Today's walk-ins still waiting on an HOD decision. */
  pending: Visit[];
  onSubmitted: (name: string) => void;
};

// The walk-in lane: someone turned up unannounced. Two things happen here —
// you register the new arrival, and you watch the ones already raised until an
// HOD decides. Both on one screen, because a guard bounces between them while
// a queue builds at the gate.
export default function GuardWalkIns({ loading, pending, onSubmitted }: Props): React.ReactElement {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-4">
      {formOpen ? (
        <WalkInRequest
          onSubmitted={(name) => { setFormOpen(false); onSubmitted(name); }}
          onCancel={() => setFormOpen(false)}
        />
      ) : (
        <button type="button" onClick={() => setFormOpen(true)}
          className="gate-tile gate-tile-primary w-full flex items-center gap-3.5">
          <span className="h-12 w-12 rounded-xl bg-brand-500/15 text-brand-700 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-[15px] font-bold text-navy-950">Register a walk-in</span>
            <span className="block text-xs text-navy-500 dark:text-navy-400 mt-0.5">
              Capture details and send the person to meet an approval request
            </span>
          </span>
        </button>
      )}

      {/* Awaiting approval */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="gate-section-title">Awaiting approval from person to meet</h2>
          <span className="glass-chip !py-1 tabular-nums">{pending.length}</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <div key={i} className="skeleton h-[68px] w-full rounded-2xl" />)}
          </div>
        ) : pending.length === 0 ? (
          <div className="card empty-state !py-12">
            <p className="text-sm font-semibold text-navy-500">Nothing waiting on a person to meet.</p>
            <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">
              Walk-ins you register will appear here until the person to meet responds.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((v) => (
              <VisitorCard key={v.id} visit={v} timeLabel={formatTime(v.created_at)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
