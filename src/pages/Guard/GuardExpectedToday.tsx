import React from 'react';
import { Link } from 'react-router-dom';
import type { Visit } from '../../types/index';
import VisitorCard, { expectedTimeLabel } from './VisitorCard';

type Props = {
  loading: boolean;
  visits: Visit[];
};

export default function GuardExpectedToday({ loading, visits }: Props): React.ReactElement {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="gate-section-title">Expected Today</h2>
          <p className="gate-section-sub">Approved &amp; awaiting arrival at the gate</p>
        </div>
        <Link to="/visitors?tab=expected" className="gate-action-ghost !px-4 text-[13px]">
          Check in &rarr;
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[68px] w-full rounded-2xl" />)}
        </div>
      ) : visits.length === 0 ? (
        <div className="card empty-state !py-12">
          <p className="text-sm font-semibold text-navy-500">No one expected today.</p>
          <p className="text-xs text-navy-400 mt-1">Pre-approved visitors will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visits.map((v, i) => (
            <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
              {/* Leading column is the booked time — the single fact a guard
                  checks an early or late arrival against. */}
              <VisitorCard visit={v} timeLabel={expectedTimeLabel(v)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
