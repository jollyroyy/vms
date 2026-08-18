import React from 'react';
import type { KpiTileSpec } from '../../components/KpiTile';
import KpiTile from '../../components/KpiTile';
import { glyph, USERS, CALENDAR_CHECK, HOURGLASS, SHIELD_X } from '../Guard/dashboardTiles';

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

// The four counts an HOD opens the page for. Same card as the guard's board,
// the Visitors rail and the admin's overview — KpiTile is the app's one KPI
// design (2026-08-13 client instruction) — and the tones carry the same
// meaning they do everywhere else: brand for the pre-booked lane, success for
// who is on site, amber for a decision owed a human, danger for a refusal.
type StatKey = 'inside' | 'approved' | 'pending' | 'rejected';

const CARDS: { key: StatKey; field: keyof Stats; spec: KpiTileSpec }[] = [
  {
    key: 'inside', field: 'inside',
    spec: {
      label: 'Inside', hint: 'Still on site',
      tone: 'text-brand-600 dark:text-brand-300', tint: 'var(--c-brand-100)', icon: glyph(...USERS),
    },
  },
  {
    key: 'approved', field: 'approvedToday',
    spec: {
      label: 'Approved', hint: 'Pre-approved today',
      tone: 'text-success-600 dark:text-success-700', tint: 'var(--c-success-100)', icon: glyph(...CALENDAR_CHECK),
    },
  },
  {
    // Named for what it actually holds: `pending_approval` is only ever reached
    // by a walk-in request raised at the gate. A pre-approval is created already
    // approved, so it never passes through this state.
    key: 'pending', field: 'pending',
    spec: {
      label: 'Pending Walk-in Approvals', hint: 'Waiting on a host',
      tone: 'text-amber-600 dark:text-amber-300', tint: 'var(--c-warning-100)', icon: glyph(...HOURGLASS),
    },
  },
  {
    key: 'rejected', field: 'rejectedToday',
    spec: {
      label: 'Rejected', hint: 'Declined by a host',
      tone: 'text-danger-600 dark:text-danger-700', tint: 'var(--c-danger-100)', icon: glyph(...SHIELD_X),
    },
  },
];

export default function OverviewStatCards({ loading, stats, activeFilter, onSelect }: Props): React.ReactElement {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3">
      {CARDS.map(({ key, field, spec }, i) => {
        const isActive = activeFilter === key;
        return (
          <KpiTile
            key={key}
            spec={spec}
            value={stats[field]}
            loading={loading}
            expanded={isActive}
            index={i}
            onDrill={() => onSelect(isActive ? '' : key)}
          />
        );
      })}
    </div>
  );
}