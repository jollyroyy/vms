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
      <div className="flex items-center gap-3 px-1 pb-2 mb-1 border-b border-surface-200/60 dark:border-white/[0.07]
                      text-[11px] uppercase tracking-wider font-semibold text-navy-500">
        <span className="flex-1 min-w-0">{headers[0]}</span>
        {headers.length === 3 && <span className="w-40 shrink-0">{headers[1]}</span>}
        <span className="w-24 shrink-0 text-right">{headers[headers.length - 1]}</span>
      </div>

      <ul>
        {rows.map((row) => (
          <li key={row.label}
              className="flex items-center gap-3 px-1 py-2.5 border-b border-surface-200/40 dark:border-white/[0.05] last:border-0">
            <span className="flex-1 min-w-0 flex items-center gap-2.5">
              {row.lead}
              <span className="truncate text-sm text-navy-800">{row.label}</span>
            </span>

            <span className="w-40 shrink-0 flex items-center gap-2">
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

            <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-navy-950 dark:text-white">
              {row.value}{unit ? ` ${unit}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
