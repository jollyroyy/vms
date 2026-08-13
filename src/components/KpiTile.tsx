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
  /** Square face: plate, numeral and label stacked and centred, sized to sit
   *  two-up in a narrow column. Same card, same border, same hover — only the
   *  arrangement of the contents changes. */
  compact?: boolean;
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
// `compact` gives the same card a square face — plate over numeral over label,
// all centred — so eight of them fit two-up in a 300px column beside the list
// they filter. It is a LAYOUT switch and nothing more: the surface, the
// hairline border, the hover lift and the active ring are the shared ones every
// other KPI card uses. The qualifier goes screen-reader-only rather than being
// dropped, because "Expected" and "Pending Approval" are ambiguous read aloud
// on their own and the accessible name is the only place that context survives
// once the square has no room to print it.
export default function KpiTile({
  spec, value, loading, expanded, index, onDrill, pressed, controlsId, caption, compact,
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
      className={`gate-tile kpi-tile ${compact ? 'kpi-tile-compact' : ''} ${active ? 'gate-tile-active' : ''} animate-slide-up`}
    >
      <span className={`kpi-plate ${spec.tone}`}>{spec.icon}</span>

      <span className={compact ? 'min-w-0' : 'min-w-0 flex-1'}>
        {value !== null && (
          <span className={`gate-tile-value block ${spec.tone}`}>{loading ? '—' : value}</span>
        )}
        <span className="gate-tile-label block">{spec.label}</span>
        {hint && (
          <span className={compact ? 'sr-only' : 'block text-[10px] text-navy-400 dark:text-navy-400 mt-0.5 leading-snug'}>
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