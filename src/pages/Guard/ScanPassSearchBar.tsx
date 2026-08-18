import React, { useState } from 'react';

// The scan desk's search box lives in the PAGE HEADER, top right (client
// instruction, 2026-08-15). It used to sit in a card below the scanner, which
// put the fallback route to a visitor's pass under the fold of a full-height
// camera frame — a guard whose camera cannot read the pass had to scroll past
// the thing that just failed them to find the way out. In the header it is on
// screen the moment the page is, beside the title, and its results render
// directly beneath it.
//
// IT SEARCHES BY THE VISITOR CARD TOO (client instruction, 2026-08-17). The
// card is the only identifier a visitor is physically holding, so it is the
// fastest thing a guard can ask for — and the row it finds carries the one
// action that visitor needs. The card leg matches the CURRENT holder only (see
// `fetchVisitsByCard`), because a card is reissued the day after it comes back.
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
        {/* No magnifying-glass glyph in the field (client instruction,
            2026-08-15). The button beside it already says Search, and the
            placeholder already says what to type — a decorative icon inside the
            box only ate the first 40px of a field a guard types a full name
            into. */}
        <div className="flex-1">
          <input
            type="search"
            aria-label="Search by visitor name, mobile number, reference or visitor card number"
            placeholder="Name, mobile, ref or card no…"
            value={input}
            // An emptied box must empty the results in the same keystroke —
            // otherwise the guard clears the field and the previous visitor's
            // pass is still sitting there, ready to be clicked.
            onChange={(e) => { setInput(e.target.value); if (!e.target.value.trim()) onQueryChange(''); }}
            className="w-full px-3.5 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm font-medium text-navy-900 placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
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
        <p className="text-xs text-navy-700 mt-1.5">Type at least two characters.</p>
      )}
    </div>
  );
}
