import React from 'react';
import { SORT_LABELS, SORT_OPTIONS, type StackSort } from '../../lib/visitorStackFilter';

type Props = {
  sort: StackSort;
  onSortChange: (s: StackSort) => void;
};

// Sort only.
//
// There was a search box here. It is gone because the top bar already carries a
// global search, and the two answered the same question differently: this one
// could only narrow the rows already loaded for the current segment, so a
// visitor who had checked out was findable in one box and not the other. One
// search, one answer — see lib/searchVisits.ts, which reaches every visit in
// any state.
//
// There is no "Filter" button either. A control that opens a panel of options
// nothing reads is worse than no control.
export default function VisitorStackToolbar({ sort, onSortChange }: Props): React.ReactElement {
  return (
    <div className="stack-toolbar">
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
    </div>
  );
}
