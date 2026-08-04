import React from 'react';
import type { GateStats } from '../../lib/useGateStats';
import { DRILL_KEYS, type DrillKey } from '../../lib/dashboardDrill';

type Props = {
  stats: GateStats;
  loading: boolean;
  activeKey: DrillKey | null;
  onDrill: (key: DrillKey) => void;
};

// Today's summary. Seven tiles, each answering a different question — see the
// `entered` vs `inside` note in lib/useGateStats.ts for why those two are not
// the same filter. `entered = inside + checkedOut` always holds.
//
// Pre-approved and Walk-ins Approved used to be a single "Expected" tile that
// counted `approved` and `walkin_approved` together. Those are two different
// populations arriving by two different routes (booked ahead vs. approved at
// the gate), each now with its own console page, so a merged tile hid the
// split the guard actually needs. Keep the two keys separate.
//
// Every tile is a drill-down, not a link. They used to navigate to
// /visitors?tab=..., which threw the guard off the board they were reading and
// (worse) pointed at audit tabs the console no longer has. Now the matching
// cards expand underneath, on this page. Only `inside` behaved this way before.
type Tile = { label: string; tone: string; hint: string };

const TILES: Record<DrillKey, Tile> = {
  preApproved: {
    label: 'Pre-approved', tone: 'text-brand-600', hint: 'Booked ahead, not yet arrived',
  },
  walkInApproved: {
    label: 'Walk-ins Approved', tone: 'text-accent-600 dark:text-accent-300', hint: 'Approved at the gate, not yet in',
  },
  inside: {
    label: 'Inside Now', tone: 'text-success-600', hint: 'Currently on the premises',
  },
  entered: {
    label: 'Entered Today', tone: 'text-navy-800', hint: 'Everyone who came through the gate',
  },
  checkedOut: {
    label: 'Checked Out', tone: 'text-navy-500', hint: 'Came and left',
  },
  declined: {
    // NOT "Denied Entry" — `rejected` means an HOD declined the request,
    // usually before the visitor ever reached the gate. Calling that "denied
    // entry" on a guard's screen implies the guard turned someone away.
    label: 'Declined', tone: 'text-danger-600', hint: 'Request declined by host',
  },
  noShow: {
    // Same orange used for the `no_show` status badge (statusStyles.ts) so the
    // colour means the same thing everywhere. Orange is a static Tailwind hue,
    // not a token, so it needs an explicit dark: variant or it goes flat on a
    // dark card.
    label: 'No Show', tone: 'text-orange-600 dark:text-orange-300', hint: 'Booked, never arrived',
  },
};

export default function DashboardSummary({ stats, loading, activeKey, onDrill }: Props): React.ReactElement {
  return (
    <section>
      <h2 className="section-title mb-3">Today&rsquo;s Summary</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {DRILL_KEYS.map((key, i) => {
          const t = TILES[key];
          const expanded = activeKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onDrill(key)}
              aria-expanded={expanded}
              className={`gate-tile ${key === 'inside' ? 'gate-tile-primary' : ''} ${expanded ? 'gate-tile-active' : ''} animate-slide-up`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <p className={`gate-tile-value ${t.tone}`}>{loading ? '—' : stats[key]}</p>
              <p className="gate-tile-label">{t.label}</p>
              <p className="text-[10px] text-navy-300 mt-1 leading-snug">{t.hint}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
