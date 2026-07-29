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
    { key: 'inside',   value: stats.inside,        label: 'Inside',   color: 'text-brand-600' },
    { key: 'approved', value: stats.approvedToday,  label: 'Approved', color: 'text-success-600' },
    { key: 'pending',  value: stats.pending,        label: 'Pending',  color: 'text-amber-600' },
    { key: 'rejected', value: stats.rejectedToday,  label: 'Rejected', color: 'text-danger-600' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ key, value, label, color }) => {
        const isActive = activeFilter === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(isActive ? '' : key)}
            className={`bg-white dark:bg-white/[0.04] rounded-xl border p-4 text-left transition-all duration-200
              ${isActive
                ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-glow-sm'
                : 'border-surface-200 hover:shadow-sm hover:border-surface-300'
              }`}
          >
            <p className={`text-3xl font-bold ${color} tabular-nums`}>{loading ? '—' : value}</p>
            <p className="text-xs text-navy-400 font-medium mt-0.5">{label}</p>
          </button>
        );
      })}
    </div>
  );
}
