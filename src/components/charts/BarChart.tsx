import React from 'react';
import { axisMax, axisTicks, GRID_OPACITY } from '../../lib/chartPalette';

export type Bar = { label: string; value: number };

type Props = {
  bars: Bar[];
  seriesLabel: string;
  color: string;
  formatValue?: (n: number) => string;
  emptyMessage?: string;
};

// Vertical bars — the Reports screen's "Visitors by Day".
//
// Same construction as LineChart, and the shared parts (`axisMax`, `axisTicks`,
// the currentColor grid) come from one place rather than being written twice:
// the two charts sit side by side on the Reports screen, and an axis that
// rounded its top differently in each would be visible at a glance.
//
// A ZERO-VALUE BAR STILL DRAWS, as a 2px stub. A day with no visitors is a
// fact; rendering nothing there is indistinguishable from a day the query
// never returned, which is exactly the ambiguity the em dash rule elsewhere in
// this app exists to remove.

const W = 560;
const H = 240;
const PAD = { top: 12, right: 14, bottom: 34, left: 40 };

export default function BarChart({
  bars, seriesLabel, color, formatValue = String, emptyMessage = 'No data for this period',
}: Props): React.ReactElement {
  if (bars.length === 0) {
    return <p className="text-sm text-navy-500 text-center py-12">{emptyMessage}</p>;
  }

  const max = axisMax(Math.max(...bars.map((b) => b.value)));
  const ticks = axisTicks(max);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / bars.length;
  const barW = Math.min(slot * 0.55, 42);

  const y = (v: number): number => PAD.top + plotH - (plotH * v) / max;

  return (
    <div className="text-navy-500">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
           aria-label={`${seriesLabel} — bar chart of ${bars.length} bars`}>
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

        {bars.map((b, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const top = b.value > 0 ? y(b.value) : PAD.top + plotH - 2;
          return (
            <g key={b.label}>
              <rect x={cx - barW / 2} y={top} width={barW}
                    height={Math.max(2, PAD.top + plotH - top)} rx={4} fill={color} />
              <text x={cx} y={H - 12} textAnchor="middle"
                    className="fill-current text-[10px]">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="flex items-center justify-center gap-2 mt-2 text-xs text-navy-700">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
        {seriesLabel}
      </p>

      <ul className="sr-only">
        {bars.map((b) => <li key={b.label}>{b.label}: {formatValue(b.value)}</li>)}
      </ul>
    </div>
  );
}
