import React from 'react';

export type KpiTileSpec = {
  label: string;
  /** Optional qualifier under the label. Omitted where it would only repeat
   *  the section heading — a hint must draw a distinction the label cannot,
   *  or it is the same word twice in one glance. */
  hint?: string;
  /** Text colour of the numeral (and plate glyph). */
  tone: string;
  /** rgb triple driving the icon plate. */
  tint: string;
  icon: React.ReactNode;
};

type Props = {
  spec: KpiTileSpec;
  /** Count shown on the tile. `null` renders no numeral — an action tile. */
  value: number | null;
  loading: boolean;
  expanded: boolean;
  index: number;
  onDrill: () => void;
  /** Reads as pressed for assistive tech. Distinct from `expanded` because
   *  some boards (admin overview) toggle a panel on click rather than keeping
   *  the tile pinned; KpiTile emits whichever the caller passes. */
  pressed?: boolean;
  /** id of the drill-down panel this tile opens (aria-controls). */
  controlsId?: string;
  /** Replaces the spec hint when given (e.g. "Click to hide" while open). */
  caption?: string;
};

// One KPI card — the single design every count card in the app uses (guard
// dashboard, Visitors rail, HOD overview, admin overview, who's-inside; the
// plain Analytics stat-cards match it via the shared CSS in
// components-surfaces.css). Icon plate on the left, then the number, the
// label and the qualifier stacked beside it, with a chevron on the trailing
// edge. Only the numeral's colour varies per tile (the spec's tone).
//
// The chevron is the reason the plate layout is worth the extra width: it says
// "this opens", and every tile here DOES open — clicking selects the matching
// slice of the board (dashboard drill-down) or filters the list beside it
// (the Visitors KPI rail). It is not a link and must never become one: reading
// the board should never cost you the board.
//
// The numeral is optional so an action tile (e.g. "Register Walk-in", which is
// a destination, not a count) can share the same card language.
//
// There is ONE shape. A `compact` square variant used to exist for the Visitors
// rail while that rail was a narrow column beside the list; the board moved on
// top of the list at this same size (2026-08-13) and the variant lost its only
// caller. Do not re-add a second face — the point of this component is that a
// guard learns the card once and then recognises it on every screen.
export default function KpiTile({
  spec, value, loading, expanded, index, onDrill, pressed, controlsId, caption,
}: Props): React.ReactElement {
  const active = expanded || pressed;
  const hint = caption ?? spec.hint;
  return (
    <button
      type="button"
      onClick={onDrill}
      aria-expanded={expanded}
      aria-pressed={pressed}
      aria-controls={controlsId}
      style={{ animationDelay: `${index * 0.04}s`, ['--kpi-tint' as string]: spec.tint }}
      className={`gate-tile kpi-tile ${active ? 'gate-tile-active' : ''} animate-slide-up`}
    >
      <span className={`kpi-plate ${spec.tone}`}>{spec.icon}</span>

      <span className="min-w-0 flex-1">
        {value !== null && (
          <span className={`gate-tile-value block ${spec.tone}`}>{loading ? '—' : value}</span>
        )}
        <span className="gate-tile-label block">{spec.label}</span>
        {hint && (
          <span className="block text-[10px] text-navy-400 dark:text-navy-400 mt-0.5 leading-snug">
            {hint}
          </span>
        )}
      </span>

      <svg className="kpi-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor"
        strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}