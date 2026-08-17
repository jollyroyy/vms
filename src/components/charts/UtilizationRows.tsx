import React from 'react';

export type UtilizationRow = {
  /** Row identity — the entry point, the department, the host. */
  label: string;
  value: number;
  /** Optional leading element: a rank chip, an avatar. */
  lead?: React.ReactNode;
};

type Props = {
  rows: UtilizationRow[];
  /** Column headers. The middle one is omitted where the share is not shown. */
  headers: [string, string] | [string, string, string];
  /** Print each row's share of the total as a percentage. */
  showShare?: boolean;
  /** Word for one unit, appended to the count — "visits", "visitors". */
  unit?: string;
  color?: string;
  emptyMessage: string;
};

// The three-column "label · proportional bar · count" list the reference
// screens use for Entry Point Utilization, Department Summary and Top Hosts
// Today. One component, because they are one shape: a name, how much of the
// whole it accounts for, and the raw figure.
//
// THE BAR IS SCALED TO THE LARGEST ROW, not to the total. Scaling to the total
// makes every bar short as soon as there are more than a handful of rows, and
// the thing a reader is comparing here is the rows against each other. The
// PERCENTAGE beside it is the share of the total, so both questions are
// answered and neither is inferred from the other's geometry.
//
// The count is always printed. A bar alone says "more than that one" and
// nothing about how many — and this is a list an admin reads to act on.
//
// THE COLUMNS ARE PROPORTIONAL, NOT FIXED PIXELS (client report, 2026-08-17:
// the Top Hosts headings were "not visible" and "overlapping"). They were
// `flex-1 + w-40 + w-24`, i.e. 280px of fixed width plus gaps inside a card
// that is one third of a three-column grid — about 270px of inner width at a
// 1280px viewport. The label column was squeezed to nothing and the row
// overflowed the card, which is what put "Host", "Share" and "Visitors" on top
// of each other. A 2:1 split with a `w-16` count cannot overflow at any width,
// because every column shrinks with the card instead of one of them refusing.
//
// THE UNIT IS NOT PRINTED ON EVERY ROW. The header above the column already
// says "Visitors" / "Total Visits", so "3 visitors" under it was the same word
// on every line — the no-duplicate-renders rule — and it was also what made a
// fixed-width count cell overflow. It survives as the cell's `aria-label`, so
// a screen reader still hears the unit with the figure.

export default function UtilizationRows({
  rows, headers, showShare = false, unit, color = '#3b82f6', emptyMessage,
}: Props): React.ReactElement {
  if (rows.length === 0) {
    return <p className="text-sm text-navy-500 text-center py-8">{emptyMessage}</p>;
  }

  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const peak = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div>
      <div className="flex items-center gap-2 px-1 pb-2 mb-1 border-b border-surface-200/60 dark:border-white/[0.07]
                      text-[11px] uppercase tracking-wider font-semibold text-navy-500">
        <span className="flex-[2] min-w-0 truncate">{headers[0]}</span>
        {headers.length === 3 && <span className="flex-1 min-w-[4rem] truncate">{headers[1]}</span>}
        <span className="w-16 shrink-0 text-right whitespace-nowrap">{headers[headers.length - 1]}</span>
      </div>

      <ul>
        {rows.map((row) => (
          <li key={row.label}
              className="flex items-center gap-2 px-1 py-2.5 border-b border-surface-200/40 dark:border-white/[0.05] last:border-0">
            <span className="flex-[2] min-w-0 flex items-center gap-2.5">
              {row.lead}
              <span className="truncate text-sm text-navy-800">{row.label}</span>
            </span>

            <span className="flex-1 min-w-[4rem] flex items-center gap-2">
              {showShare && (
                <span className="w-9 text-xs tabular-nums text-navy-700 shrink-0">
                  {total === 0 ? '0%' : `${Math.round((row.value / total) * 100)}%`}
                </span>
              )}
              <span className="flex-1 h-2 rounded-full bg-surface-200/70 dark:bg-white/[0.08] overflow-hidden">
                <span className="block h-full rounded-full transition-all duration-500"
                      style={{ width: `${(row.value / peak) * 100}%`, background: color }} />
              </span>
            </span>

            <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-navy-950 dark:text-white"
                  aria-label={unit ? `${row.value} ${unit}` : undefined}>
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
