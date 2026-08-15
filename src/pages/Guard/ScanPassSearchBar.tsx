import React, { useState } from 'react';

// The scan desk's search box lives in the PAGE HEADER, top right (client
// instruction, 2026-08-15). It used to sit in a card below the scanner, which
// put the fallback route to a visitor's pass under the fold of a full-height
// camera frame — a guard whose camera cannot read the pass had to scroll past
// the thing that just failed them to find the way out. In the header it is on
// screen the moment the page is, beside the title, and its results render
// directly beneath it.
//
// The search is SUBMITTED, not typed-into-the-void (client instruction,
// 2026-08-15). It used to fire on its own after a 300ms pause, which left the
// guard with no control to press and no moment that said "now it looked" — on a
// slow gate connection that reads as a field that ignores you. `input` is what
// is typed, the `query` handed up is what was asked for; Enter or the Search
// button moves one to the other. Clearing the box clears the results in the
// same keystroke, because an emptied field showing old hits is the same lie.

/** Mirrors the search hook's own floor — below this nothing is sent, so the
 *  Search button must not look pressable either. */
export const MIN_QUERY = 2;

export default function ScanPassSearchBar({
  onQueryChange,
}: {
  onQueryChange: (q: string) => void;
}): React.ReactElement {
  const [input, setInput] = useState('');
  const tooShort = input.trim().length > 0 && input.trim().length < MIN_QUERY;

  return (
    <div className="w-full sm:w-[24rem] shrink-0">
      <form
        onSubmit={(e) => { e.preventDefault(); onQueryChange(input.trim()); }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-navy-300 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="search"
            aria-label="Search by visitor name or mobile number"
            placeholder="Name, mobile or pass number…"
            value={input}
            // An emptied box must empty the results in the same keystroke —
            // otherwise the guard clears the field and the previous visitor's
            // pass is still sitting there, ready to be clicked.
            onChange={(e) => { setInput(e.target.value); if (!e.target.value.trim()) onQueryChange(''); }}
            className="w-full pl-10 pr-3 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm font-medium text-navy-900 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={input.trim().length < MIN_QUERY}
          className="btn-primary px-4 py-2.5 text-sm font-bold shrink-0"
        >
          Search
        </button>
      </form>
      {/* Below two characters the query is too broad to be worth a round-trip,
          which is the hook's own rule — say so beside the box rather than
          returning an empty list, which reads as "no such visitor". */}
      {tooShort && (
        <p className="text-xs text-navy-500 mt-1.5">Type at least two characters.</p>
      )}
    </div>
  );
}
