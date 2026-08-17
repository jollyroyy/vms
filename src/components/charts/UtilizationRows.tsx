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
  emptyMessage: string;
};

// The three-column "label · share · count" list the reference screens use for
// Department Summary and Top Hosts. One component, because they are one shape:
// a name, how much of the whole it accounts for, and the raw figure.
//
// THERE IS NO BAR, AND THE NAME IS NEVER CLIPPED (client instruction,
// 2026-08-18: on Top Hosts, show the host's name in full and the share). The
// proportional bar was the third thing competing for a card that is one third
// of a three-column grid — about 270px of inner width at 1280px — and it was
// paid for out of the only column whose content cannot be guessed from its
// neighbours. A bar says "more than that one"; the percentage beside it says
// exactly how much, and the count says how many, so the bar was the one of the
// three that carried no figure of its own.
//
// With it gone the label column takes the width back and WRAPS instead of
// truncating: a clipped name is indistinguishable from a short one (the same
// argument PassField makes), and half a host's name is not a host.
//
// THE COLUMNS ARE PROPORTIONAL, NOT FIXED PIXELS (client report, 2026-08-17:
// the Top Hosts headings were "not visible" and "overlapping"). They were
// `flex-1 + w-40 + w-24`, i.e. 280px of fixed width plus gaps. Every column
// shrinks with the card now, so the row cannot overflow at any width.
//
// THE UNIT IS NOT PRINTED ON EVERY ROW. The header above the column already
// says "Visitors" / "Total Visits", so "3 visitors" under it was the same word
// on every line — the no-duplicate-renders rule — and it was also what made a
// fixed-width count cell overflow. It survives as the cell's `aria-label`, so
// a screen reader still hears the unit with the figure.

export default function UtilizationRows({
  rows, headers, showShare = false, unit, emptyMessage,
}: Props): React.ReactElement {
  if (rows.length === 0) {
    return <p className="text-sm text-navy-500 text-center py-8">{emptyMessage}</p>;
  }

  const total = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <div>
      {/* The same header treatment every TABLE on this deployment wears —
          `.table-head` carries the size, the uppercasing, the GOLD and the
          bold weight (client instruction, 2026-08-18: table headers are bold).
          This list is a table in everything but its markup, so it must not
          pick its own heading colour; the class is the one place that decides. */}
      <div className="table-head flex items-center gap-2 px-1 pb-2 mb-1 rounded-t
                      border-b border-surface-200/60 dark:border-white/[0.07]">
        <span className="flex-1 min-w-0 break-words">{headers[0]}</span>
        {showShare && headers.length === 3 && <span className="w-12 shrink-0 text-right">{headers[1]}</span>}
        <span className="w-16 shrink-0 text-right whitespace-nowrap">{headers[headers.length - 1]}</span>
      </div>

      <ul>
        {rows.map((row) => (
          <li key={row.label}
              className="flex items-center gap-2 px-1 py-2.5 border-b border-surface-200/40 dark:border-white/[0.05] last:border-0">
            <span className="flex-1 min-w-0 flex items-center gap-2.5">
              {row.lead}
              <span className="text-sm text-navy-800 break-words">{row.label}</span>
            </span>

            {showShare && (
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-navy-700">
                {total === 0 ? '0%' : `${Math.round((row.value / total) * 100)}%`}
              </span>
            )}

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
