import React from 'react';

interface Stats {
  inside: number;
  approvedToday: number;
  pending: number;
  rejectedToday: number;
}

type Props = {
  loading: boolean;
  stats: Stats;
  activeFilter: string | null;
  onSelect: (key: string) => void;
};

export default function OverviewStatCards({ loading, stats, activeFilter, onSelect }: Props): React.ReactElement {
  const cards = [
    // These are the largest type on the page, so each needs a dark: variant:
    // the 600 shades are tuned to sit on white and go muddy on a dark card.
    { key: 'inside',   value: stats.inside,         label: 'Inside',           color: 'text-brand-600 dark:text-brand-300' },
    { key: 'approved', value: stats.approvedToday,  label: 'Approved',         color: 'text-success-600 dark:text-success-700' },
    // Named for what it actually holds: `pending_approval` is only ever reached
    // by a walk-in request raised at the gate. A pre-approval is created already
    // approved, so it never passes through this state.
    { key: 'pending',  value: stats.pending,        label: 'Pending Walk-in Approvals', color: 'text-amber-600 dark:text-amber-300' },
    { key: 'rejected', value: stats.rejectedToday,  label: 'Rejected',         color: 'text-danger-600 dark:text-danger-700' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ key, value, label, color }) => {
        const isActive = activeFilter === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(isActive ? '' : key)}
            className={`stat-card card-hover text-left w-full cursor-pointer
              ${isActive ? 'ring-2 ring-brand-500/20 border-brand-500' : ''}`}
          >
            <p className={`stat-value ${color}`}>{loading ? '—' : value}</p>
            <p className="stat-label mt-1">{label}</p>
          </button>
        );
      })}
    </div>
  );
}
