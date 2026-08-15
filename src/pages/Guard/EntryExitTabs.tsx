import React from 'react';

// The Entry & Exit tab's two lanes: who is on site, and who has left today.
//
// One list holding both was the wrong shape for the question. A guard opens
// this tab already knowing which of the two they are asking about — "who is
// still in the building" and "when did she leave" are different jobs, and
// interleaving them meant scanning past the group you did not want. Splitting
// them also lets each lane keep its own empty state, so "nobody is inside" and
// "nobody has left yet" stop being the same sentence.
//
// It reuses `.gate-tab` / `.gate-tab-bar` from styles/components-guard.css —
// the glass bar with the gold gradient on the active lane that the guard
// surface already uses for tab bars. A bespoke control here would be a second
// thing to learn for a job the app already has a shape for.
//
// The counts live ON the tabs rather than in a separate line, because a lane's
// count is the length of the list that lane opens — the same rule
// `lib/guardTiles.ts` holds for the dashboard tiles.

export type EntryExitLane = 'inside' | 'departed';

export const LANE_LABEL: Record<EntryExitLane, string> = {
  inside: 'Checked In',
  departed: 'Checked Out',
};

const LANE_ICON: Record<EntryExitLane, React.ReactElement> = {
  // Arrow into a door — entry.
  inside: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h5a3 3 0 013 3v1" />
    </svg>
  ),
  // Arrow out of a door — exit.
  departed: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  ),
};

const LANES: EntryExitLane[] = ['inside', 'departed'];

type EntryExitTabsProps = {
  lane: EntryExitLane;
  onSelect: (lane: EntryExitLane) => void;
  counts: Record<EntryExitLane, number>;
  /** Counts are unknown until the first load lands; a zero shown during it
   *  would read as "nobody is inside", which is a claim, not a loading state. */
  loading?: boolean;
};

export default function EntryExitTabs({ lane, onSelect, counts, loading }: EntryExitTabsProps): React.ReactElement {
  return (
    <div className="gate-tab-bar" role="tablist" aria-label="Entry and exit">
      {LANES.map((key) => {
        const active = lane === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(key)}
            className={`gate-tab ${active ? 'gate-tab-active' : ''}`}>
            {LANE_ICON[key]}
            {LANE_LABEL[key]}
            <span className="gate-tab-count">{loading ? '…' : counts[key]}</span>
          </button>
        );
      })}
    </div>
  );
}
