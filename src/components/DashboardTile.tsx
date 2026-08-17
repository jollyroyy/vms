import React from 'react';

// THE dashboard KPI tile — one card, drawn once, used by the guard board and
// the HOD board alike.
//
// It was inline markup inside GuardDashboardMain until 2026-08-16, when the
// client asked for the HOD view to look and read exactly like the guard's.
// Pasting the same forty characters of Tailwind into a second file would have
// made the two boards *currently* identical and free to drift on the next edit;
// sharing the component makes them identical by construction. That is the same
// argument KpiTile.tsx makes for the Visitors rail and the admin overview — the
// difference is only that this board's tiles are the icon-plate variant the
// 2026-08-14 reference design froze, and the visual freeze is why the two
// components have not yet been merged into one.
//
// A tile is a BUTTON and never a link: pressing it swaps the panel below, and
// reading the board must never cost you the board. Its number is always the
// length of the list it opens — that rule lives with the callers
// (lib/guardTiles.ts, lib/hodTiles.ts), which is what stops a count and its
// rows from describing different sets.

type Props = {
  /** The tile's label, which IS the heading of the panel it opens. */
  label: string;
  /** The count. `loading` prints an em dash instead. */
  value: number;
  /** SVG path from lib/tileIcons.ts. */
  icon: string;
  /** Border + text classes for the icon ring, e.g. `border-brand-500/30 text-brand-500`. */
  ring: string;
  active: boolean;
  loading: boolean;
  /** The board's secondary row — same shape and interaction, smaller. */
  compact?: boolean;
  onSelect: () => void;
};

export default function DashboardTile({
  label, value, icon, ring, active, loading, compact = false, onSelect,
}: Props): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`rounded-2xl border ${compact ? 'px-4 py-3.5 gap-3' : 'px-5 py-5 gap-4'} flex items-center shadow-glow-sm text-left w-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow ${
        active
          ? 'bg-brand-600/10 dark:bg-brand-500/15 border-brand-500/40 ring-1 ring-brand-500/30'
          : 'bg-surface-100/60 dark:bg-white/[0.03] border-surface-200/60 dark:border-white/[0.07]'
      }`}>
      <span className={`shrink-0 rounded-full border ${ring} flex items-center justify-center ${compact ? 'w-9 h-9' : 'w-12 h-12'}`}>
        <svg className={compact ? 'w-4.5 h-4.5' : 'w-6 h-6'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        {/* One navy step, no `dark:` override — the scale is inverted per theme,
            so a single number resolves correctly in both and the old
            `text-navy-500 dark:text-navy-600` pair was tuning by hand what the
            tokens already do. Matches AdminKpiTile, so a label reads the same
            weight on the admin board as on this one. */}
        <span className={`block font-medium leading-snug break-words text-navy-700 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
          {label}
        </span>
        <span className={`block font-display leading-tight font-medium tracking-tight tabular-nums text-navy-950 ${compact ? 'text-[1.5rem]' : 'text-[2rem]'}`}>
          {loading ? '—' : value}
        </span>
      </span>
    </button>
  );
}
