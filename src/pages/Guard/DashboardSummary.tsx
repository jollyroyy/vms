import React from 'react';
import { Link } from 'react-router-dom';
import type { GateStats } from '../../lib/useGateStats';

type Props = {
  stats: GateStats;
  loading: boolean;
  insideOpen: boolean;
  onToggleInside: () => void;
};

// Today's summary. Five tiles, each answering a different question — see the
// `entered` vs `inside` note in lib/useGateStats.ts for why those two are not
// the same filter. `entered = inside + checkedOut` always holds.
type Tile = {
  key: string;
  label: string;
  value: number;
  tone: string;
  hint: string;
  to: string | null; // null → the tile toggles the on-site list instead
};

export default function DashboardSummary({ stats, loading, insideOpen, onToggleInside }: Props): React.ReactElement {
  const tiles: Tile[] = [
    {
      key: 'expected', label: 'Expected', value: stats.expected,
      tone: 'text-brand-600', hint: 'Approved, not yet arrived',
      to: '/visitors?tab=expected',
    },
    {
      key: 'inside', label: 'Inside Now', value: stats.inside,
      tone: 'text-success-600', hint: 'Currently on the premises',
      to: null,
    },
    {
      key: 'entered', label: 'Entered Today', value: stats.entered,
      tone: 'text-navy-800', hint: 'Everyone who came through the gate',
      to: '/visitors?tab=inside',
    },
    {
      key: 'checkedOut', label: 'Checked Out', value: stats.checkedOut,
      tone: 'text-navy-500', hint: 'Came and left',
      to: '/visitors?tab=checked-out',
    },
    {
      key: 'declined', label: 'Declined', value: stats.declined,
      // NOT "Denied Entry" — `rejected` means an HOD declined the request,
      // usually before the visitor ever reached the gate. Calling that "denied
      // entry" on a guard's screen implies the guard turned someone away.
      tone: 'text-danger-600', hint: 'Request declined by host',
      to: '/visitors?tab=rejected',
    },
  ];

  return (
    <section>
      <h2 className="section-title mb-3">Today&rsquo;s Summary</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map((t, i) => {
          const isPrimary = t.key === 'inside';
          const body = (
            <>
              <p className={`gate-tile-value ${t.tone}`}>{loading ? '—' : t.value}</p>
              <p className="gate-tile-label">{t.label}</p>
              <p className="text-[10px] text-navy-300 mt-1 leading-snug">{t.hint}</p>
            </>
          );
          const cls = `gate-tile ${isPrimary ? 'gate-tile-primary' : ''} animate-slide-up`;
          const style = { animationDelay: `${i * 0.04}s` };

          // Inside Now has nowhere to navigate — the on-site cards live on this
          // page, so the tile expands them in place.
          if (t.to === null) {
            return (
              <button key={t.key} type="button" onClick={onToggleInside}
                aria-expanded={insideOpen} className={cls} style={style}>
                {body}
              </button>
            );
          }
          return <Link key={t.key} to={t.to} className={cls} style={style}>{body}</Link>;
        })}
      </div>
    </section>
  );
}
