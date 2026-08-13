import React from 'react';
import { SORT_LABELS, SORT_OPTIONS, type StackSort } from '../../lib/visitorStackFilter';

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  sort: StackSort;
  onSortChange: (s: StackSort) => void;
  /** Rows currently shown, so the toolbar can say when a query is hiding some. */
  shown: number;
  total: number;
};

// Search and sort for the stacked list. Both narrow what is already loaded —
// there is no "Filter" button that opens a panel of controls nothing reads.
export default function VisitorStackToolbar({
  query, onQueryChange, sort, onSortChange, shown, total,
}: Props): React.ReactElement {
  return (
    <div className="stack-toolbar">
      <div className="stack-search">
        <svg className="stack-search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="search"
          className="input stack-search-input"
          placeholder="Search by name, vendor, phone or reference…"
          aria-label="Search visitors"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      <label className="stack-sort">
        <span className="sr-only">Sort visitors</span>
        <svg className="w-4 h-4 shrink-0 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
        </svg>
        <select className="input stack-sort-select" value={sort}
          onChange={(e) => onSortChange(e.target.value as StackSort)}>
          {SORT_OPTIONS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
        </select>
      </label>

      {query.trim() !== '' && (
        <p className="stack-toolbar-note" role="status">
          {shown} of {total} shown
        </p>
      )}
    </div>
  );
}
