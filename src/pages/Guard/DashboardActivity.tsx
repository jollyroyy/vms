import React from 'react';
import type { Visit } from '../../types/index';
import { formatTime } from '../../lib/formatDate';
import VisitorCard from './VisitorCard';

type Props = {
  visits: Visit[];
  loading: boolean;
  onSelect?: (visit: Visit) => void;
};

// The gate log. The wireframe drew this as a table (Photo | Visitor | Host |
// Check-in | Status); it ships as cards instead, because the same five fields
// on a card survive a narrow gate terminal without horizontal scrolling, and
// the status rail gives a faster scan than a status column would.
export default function DashboardActivity({ visits, loading, onSelect }: Props): React.ReactElement {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title">Recent Activity</h2>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-navy-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500" />
          </span>
          Live
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[68px] w-full rounded-2xl" />)}
        </div>
      ) : visits.length === 0 ? (
        <div className="card empty-state">
          <p className="text-sm font-semibold text-navy-500">No gate activity yet today.</p>
          <p className="text-xs text-navy-400 mt-1">Check-ins and check-outs will appear here as they happen.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visits.map((v, i) => (
            <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
              <VisitorCard
                visit={v}
                onSelect={onSelect}
                // Show when they actually arrived; fall back to when the visit
                // was raised for anyone who has not reached the gate yet.
                timeLabel={formatTime(v.checked_in_at ?? v.created_at)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
