import React from 'react';

// The Live Check-In tab's two lanes: who is on site, and who has left today.
//
// Modelled directly on the guard's `EntryExitTabs` (`pages/Guard/EntryExitTabs.tsx`)
// and its reasoning, not imported from it: that component is styled with the
// guard surface's `.gate-tab` classes and this is a separate page tree, but the
// shape of the problem is identical — "who is still here" and "who left today"
// are two different questions, and interleaving them means scanning past the
// half you did not ask for.
//
// THE COUNT LIVES ON EACH TAB, not in a summary line above them — a lane's
// number is the length of the list that lane opens, the same rule
// `lib/guardTiles.ts` holds for the dashboard tiles. Printing a total above
// the tabs as well would be the same fact stated twice on one screen.

export type LiveCheckInLane = 'inside' | 'departed';

export const LANE_LABEL: Record<LiveCheckInLane, string> = {
  inside: 'Inside',
  departed: 'Checked Out',
};

const LANES: LiveCheckInLane[] = ['inside', 'departed'];

type Props = {
  lane: LiveCheckInLane;
  onSelect: (lane: LiveCheckInLane) => void;
  counts: Record<LiveCheckInLane, number>;
  loading: boolean;
};

export default function LiveCheckInTabs({ lane, onSelect, counts, loading }: Props): React.ReactElement {
  return (
    <div role="tablist" aria-label="Live check-in" className="flex gap-2 mb-4">
      {LANES.map((key) => {
        const active = lane === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 border transition-colors ${
              active
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-surface-100/60 dark:bg-white/[0.03] text-navy-800 border-surface-200/60 dark:border-white/[0.07]'
            }`}
          >
            {LANE_LABEL[key]}
            <span className={`tabular-nums text-xs ${active ? 'text-white/80' : 'text-navy-500'}`}>
              {loading ? '…' : counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
