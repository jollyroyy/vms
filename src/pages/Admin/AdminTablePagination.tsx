import React from 'react';

type Props = {
  /** Rows in the FILTERED set, not the loaded window — "Showing X to Y of N"
   *  must count what the reader is actually looking at, or a filter that
   *  narrows the table to three rows would still claim "of 500". */
  totalItems: number;
  /** 1-indexed, matching how the "Showing" sentence reads. */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
};

const DEFAULT_SIZES = [10, 25, 50];

// A GENERIC pager, deliberately holding no idea of what a "row" is. Every
// admin tab that lists visits — Pre-Registration first, more to follow — needs
// the identical sentence and the identical Prev/Next pair, and a pager that
// knew about `visits` would be copied wholesale for the next tab instead of
// reused. It owns no state: the page and the size live in the parent, because
// the parent is the one that also has to reset the page to 1 when a filter
// changes the row count out from under the current page.

export default function AdminTablePagination({
  totalItems, page, pageSize, onPageChange, onPageSizeChange, pageSizeOptions = DEFAULT_SIZES,
}: Props): React.ReactElement {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  // Clamped rather than trusted: a stale `page` (the filtered set just got
  // smaller) must never compute a negative "from" or a Y past the last row.
  const current = Math.min(Math.max(1, page), totalPages);
  const from = totalItems === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-navy-700">
      <span>
        {totalItems === 0
          ? 'No entries to show'
          : `Showing ${from} to ${to} of ${totalItems} entries`}
      </span>

      {/* This cluster (rows-per-page + Prev/Next) has no wrap of its own, so on
          a phone the three controls were the ones overflowing past the outer
          row's own `flex-wrap` break — the outer wrap only guarantees this
          whole group drops to its own line, not that the group itself fits
          343px. */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-navy-700">
          <span className="whitespace-nowrap">Rows per page</span>
          <select
            className="input !py-1 !w-auto"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-surface-200/60 dark:border-white/[0.08]
                       text-navy-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-100/60"
            disabled={current <= 1}
            onClick={() => onPageChange(current - 1)}
          >
            Previous
          </button>
          <span className="px-2 text-navy-700 tabular-nums">Page {current} of {totalPages}</span>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-surface-200/60 dark:border-white/[0.08]
                       text-navy-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-100/60"
            disabled={current >= totalPages}
            onClick={() => onPageChange(current + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
