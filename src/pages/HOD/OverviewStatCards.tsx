import React from 'react';
import { Link } from 'react-router-dom';

interface Stats {
  inside: number;
  approvedToday: number;
  pending: number;
  rejectedToday: number;
}

type Props = {
  loading: boolean;
  stats: Stats;
};

export default function OverviewStatCards({ loading, stats }: Props): React.ReactElement {
  const cards = [
    { value: stats.inside, label: 'Inside', color: 'text-brand-600', link: '/approvals?tab=pending' },
    { value: stats.approvedToday, label: 'Approved', color: 'text-success-600', link: '/approvals?tab=approved' },
    { value: stats.pending, label: 'Pending', color: 'text-amber-600', link: '/approvals?tab=pending' },
    { value: stats.rejectedToday, label: 'Rejected', color: 'text-danger-600', link: '/approvals?tab=rejected' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ value, label, color, link }) => {
        const content = (
          <>
            <p className={`text-3xl font-bold ${color} tabular-nums`}>{loading ? '—' : value}</p>
            <p className="text-xs text-navy-400 font-medium mt-0.5">{label}</p>
          </>
        );
        return link ? (
          <Link key={label} to={link} className="bg-white dark:bg-white/[0.04] rounded-xl border border-surface-200 p-4 hover:shadow-sm transition-shadow">
            {content}
          </Link>
        ) : (
          <div key={label} className="bg-white dark:bg-white/[0.04] rounded-xl border border-surface-200 p-4">
            {content}
          </div>
        );
      })}
    </div>
  );
}
