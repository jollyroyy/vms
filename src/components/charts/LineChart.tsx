import React from 'react';
import { axisMax, axisTicks, GRID_OPACITY } from '../../lib/chartPalette';

export type LinePoint = { label: string; value: number };

type Props = {
  points: LinePoint[];
  /** Series name, printed in the legend under the plot. */
  seriesLabel: string;
  color: string;
  /** Formats the y-axis ticks — seconds get an "s", counts get nothing. */
  formatValue?: (n: number) => string;
  emptyMessage?: string;
};

// A single-series line chart, hand-drawn in SVG.
//
// No charting library. Adding one to draw two shapes would put a runtime
// dependency (and its transitive tree) in the bundle for something the browser
// already renders natively, and every existing chart in this app is CSS or SVG
// for the same reason.
//
// The plot is a fixed-viewBox SVG scaled with `w-full`, so the aspect ratio is
// stable and the text never stretches — `preserveAspectRatio="none"` would fit
// the width perfectly and squash every label with it.
//
// GRID LINES AND TICKS ARE `currentColor` AT LOW OPACITY, never a fixed grey.
// The navy scale is inverted between themes (see CLAUDE.md), so a hardcoded
// axis colour is the exact bug that has already made three surfaces unreadable
// in dark mode; inheriting the text colour means the axis follows whatever the
// card resolves to.
//
// It also renders an `sr-only` list of every label/value pair. That is the
// chart's accessible content — a screen reader gets the numbers rather than
// "graphic" — and it is what the tests read, so a test asserts on the DATA
// rather than on path geometry that would break on any cosmetic change.

const W = 560;
const H = 220;
const PAD = { top: 12, right: 14, bottom: 30, left: 38 };

export default function LineChart({
  points, seriesLabel, color, formatValue = String, emptyMessage = 'No data for this period',
}: Props): React.ReactElement {
  if (points.length === 0) {
    return <p className="text-sm text-navy-500 text-center py-12">{emptyMessage}</p>;
  }

  const max = axisMax(Math.max(...points.map((p) => p.value)));
  const ticks = axisTicks(max);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // A single point has no span to divide across; anchoring it mid-plot beats
  // dividing by zero and beats pinning it to the left edge, where it reads as
  // the start of a line that was cut off.
  const x = (i: number): number =>
    points.length === 1 ? PAD.left + plotW / 2 : PAD.left + (plotW * i) / (points.length - 1);
  const y = (v: number): number => PAD.top + plotH - (plotH * v) / max;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)},${PAD.top + plotH} L${x(0).toFixed(1)},${PAD.top + plotH} Z`;
  const gradientId = `line-fill-${seriesLabel.replace(/\W+/g, '')}`;

  // Every label on a 24-hour axis would collide; show roughly eight.
  const labelStep = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="text-navy-500">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
           aria-label={`${seriesLabel} — line chart of ${points.length} points`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
                  stroke="currentColor" strokeOpacity={GRID_OPACITY} strokeDasharray="3 4" />
            <text x={PAD.left - 8} y={y(t) + 3.5} textAnchor="end"
                  className="fill-current text-[10px] tabular-nums">
              {formatValue(t)}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke={color} strokeWidth={2.2}
              strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle key={p.label} cx={x(i)} cy={y(p.value)} r={3.4} fill={color}
                  stroke="rgb(var(--c-surface-50))" strokeWidth={1.5} />
        ))}

        {points.map((p, i) => (i % labelStep === 0 ? (
          <text key={p.label} x={x(i)} y={H - 10} textAnchor="middle"
                className="fill-current text-[10px] tabular-nums">
            {p.label}
          </text>
        ) : null))}
      </svg>

      <p className="flex items-center justify-center gap-2 mt-2 text-xs text-navy-700">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
        {seriesLabel}
      </p>

      <ul className="sr-only">
        {points.map((p) => <li key={p.label}>{p.label}: {formatValue(p.value)}</li>)}
      </ul>
    </div>
  );
}
