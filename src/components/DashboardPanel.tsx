import React from 'react';

// The frame every dashboard list sits in: the glass card, the brand-tinted
// glyph, the display heading and the count beside it.
//
// Extracted 2026-08-16 when the HOD board was rebuilt on the guard board's
// design. Four screens now open a card with a title and a list in it, and four
// copies of the same twelve Tailwind classes is four chances for one of them to
// end up with a different corner radius or a different heading size — which is
// exactly the drift the client reported between the two views.
//
// The COUNT is optional and, where it is passed, it is the length of the list
// rendered inside — never a separately derived number.

type Props = {
  /** SVG path from lib/tileIcons.ts. */
  icon: string;
  heading: string;
  /** Length of the list inside. Omitted where the panel holds no list. */
  count?: number;
  /** Suppresses the count while the rows are still loading. */
  loading?: boolean;
  /** A single control on the trailing edge (e.g. a link to the full desk). */
  action?: React.ReactNode;
  children: React.ReactNode;
};

export default function DashboardPanel({
  icon, heading, count, loading = false, action, children,
}: Props): React.ReactElement {
  return (
    <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-brand-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </span>
        <h2 className="font-display text-h2 text-navy-950 dark:text-white">{heading}</h2>
        {count !== undefined && (
          <span className="text-sm font-semibold tabular-nums text-navy-700">{loading ? '' : count}</span>
        )}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </div>
  );
}
