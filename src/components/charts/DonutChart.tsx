import React from 'react';
import { chartColor } from '../../lib/chartPalette';

export type DonutSlice = { label: string; value: number };

type Props = {
  slices: DonutSlice[];
  /** What one unit is, for the accessible summary — "visits", "passes". */
  unit?: string;
  emptyMessage?: string;
};

const SIZE = 220;
const R_OUTER = 100;
const R_INNER = 58;
const C = SIZE / 2;

/** Cartesian point on a circle, measuring clockwise from twelve o'clock — the
 *  direction a reader traces a pie without being told to. */
function point(radius: number, fraction: number): [number, number] {
  const angle = 2 * Math.PI * fraction - Math.PI / 2;
  return [C + radius * Math.cos(angle), C + radius * Math.sin(angle)];
}

function arcPath(from: number, to: number): string {
  const [x1, y1] = point(R_OUTER, from);
  const [x2, y2] = point(R_OUTER, to);
  const [x3, y3] = point(R_INNER, to);
  const [x4, y4] = point(R_INNER, from);
  const large = to - from > 0.5 ? 1 : 0;
  return [
    `M${x1.toFixed(2)},${y1.toFixed(2)}`,
    `A${R_OUTER},${R_OUTER} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`,
    `L${x3.toFixed(2)},${y3.toFixed(2)}`,
    `A${R_INNER},${R_INNER} 0 ${large} 0 ${x4.toFixed(2)},${y4.toFixed(2)}`,
    'Z',
  ].join(' ');
}

// A donut with the legend beside it, drawn in SVG.
//
// THE LEGEND CARRIES THE LABEL AND THE PERCENTAGE, and the arcs carry no text
// at all. A slice thin enough to need a label is too thin to hold one, and the
// reference screens make the same call. Colour is never the only carrier: the
// legend prints the name next to the swatch, so a reader who cannot separate
// the amber slice from the green one still gets every figure.
//
// A SINGLE SLICE IS A FULL RING, drawn as a `circle`, not an arc. A 360° arc
// has identical start and end points, which SVG resolves as a zero-length path
// — the one-purpose day would have rendered an empty card.

export default function DonutChart({
  slices, unit = 'visits', emptyMessage = 'No data for this period',
}: Props): React.ReactElement {
  const positive = slices.filter((s) => s.value > 0);
  const total = positive.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return <p className="text-sm text-navy-500 text-center py-12">{emptyMessage}</p>;
  }

  let cursor = 0;
  const drawn = positive.map((slice, i) => {
    const from = cursor;
    cursor += slice.value / total;
    return { ...slice, from, to: cursor, color: chartColor(i), pct: (slice.value / total) * 100 };
  });

  return (
    // THE LAYOUT WRAPS ON THE CARD'S OWN WIDTH, not on the viewport's.
    // `flex-col sm:flex-row` asked the wrong question: this card is one third
    // of a three-column grid, so at a 1280px viewport — which is `sm` and up,
    // so the row layout was in force — its inner width is about 270px, and a
    // 176px donut beside a legend that cannot go below its swatch, gap and
    // percentage overflowed the card. `flex-wrap` plus a legend basis means the
    // legend drops UNDER the donut whenever there is not room beside it,
    // whatever the viewport is doing. `min-w-0` on the list and on each row is
    // what lets `truncate` actually engage on a long purpose name; without it
    // the row's min-content width is the label's full width and the flex
    // container is pushed past its parent.
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-36 h-36 sm:w-40 sm:h-40 shrink-0" role="img"
           aria-label={`Breakdown of ${total} ${unit} across ${drawn.length} categories`}>
        {drawn.length === 1 && drawn[0] ? (
          <circle cx={C} cy={C} r={(R_OUTER + R_INNER) / 2} fill="none"
                  stroke={drawn[0].color} strokeWidth={R_OUTER - R_INNER} />
        ) : (
          drawn.map((s) => (
            <path key={s.label} d={arcPath(s.from, s.to)} fill={s.color}
                  stroke="rgb(var(--c-surface-50))" strokeWidth={1.5} />
          ))
        )}
      </svg>

      <ul className="grow shrink basis-40 min-w-0 space-y-2.5">
        {drawn.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-sm min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} aria-hidden="true" />
            <span className="flex-1 min-w-0 truncate text-navy-800">{s.label}</span>
            <span className="shrink-0 tabular-nums font-semibold text-navy-950 dark:text-white">
              {Math.round(s.pct)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
