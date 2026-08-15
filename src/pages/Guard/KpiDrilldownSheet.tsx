import React, { useEffect } from 'react';

import type { ReportVisit } from '../../lib/reportRow';

// Stacked drilldown list for one KPI tile: one card per visitor with the
// essentials (name, host · department · purpose, time, status) — tapping a
// card opens the full visitor details popup. Renders right below the tiles
// so the guard never loses the board. Closes on Escape or the Close link.

export type TileSpec = {
  key: string;
  label: string;
  count: number;
  ring: string; // border/tint colour classes
  icon: string;
};

export type DrilldownPill = { label: string; cls: string };

type DrilldownProps = {
  tile: TileSpec;
  visits: ReportVisit[];
  loading: boolean;
  initialsOf: (name: string | null | undefined) => string;
  statusPill: (visit: ReportVisit) => DrilldownPill;
  timeOf: (visit: ReportVisit) => string;
  onOpen: (v: ReportVisit) => void;
  onClose: () => void;
};

export default function KpiDrilldownSheet({
  tile,
  visits,
  loading,
  initialsOf,
  statusPill,
  timeOf,
  onOpen,
  onClose,
}: DrilldownProps): React.ReactElement {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm animate-fade-in" data-testid="kpi-drilldown">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`shrink-0 w-10 h-10 rounded-full border ${tile.ring} flex items-center justify-center`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={tile.icon} />
            </svg>
          </span>
          <div>
            <h3 className="font-display text-base font-semibold text-navy-950 dark:text-white">{tile.label}</h3>
            <p className="text-[11px] font-medium text-navy-400 dark:text-navy-500 uppercase tracking-wider">
              {visits.length} {visits.length === 1 ? 'visitor' : 'visitors'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close visitor list"
          className="text-xs font-semibold text-brand-500 hover:text-brand-400 uppercase tracking-wider transition-colors">
          Close
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-navy-400 py-6 text-center">Loading…</p>
      ) : visits.length === 0 ? (
        <p className="text-sm text-navy-400 py-6 text-center">No visitors behind this count right now.</p>
      ) : (
        <ul className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
          {visits.map((v) => {
            const pill = statusPill(v);
            return (
              <li
                key={v.id}
                onClick={() => onOpen(v)}
                className="rounded-xl border border-surface-200/50 dark:border-white/[0.06] bg-surface-100/70 dark:bg-white/[0.04] px-4 py-3 flex items-center gap-3.5 cursor-pointer hover:border-brand-500/30 hover:bg-brand-600/5 transition-colors">
                <span className="shrink-0 w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
                  {initialsOf(v.visitor?.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy-950 dark:text-white truncate">{v.visitor?.full_name ?? 'Unknown'}</p>
                  <p className="text-xs text-navy-500 dark:text-navy-400 truncate mt-0.5">
                    {v.host?.full_name ?? '—'} · {v.department?.name ?? '—'} · {v.purpose ?? '—'}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-xs font-semibold text-navy-700 dark:text-navy-300">{timeOf(v)}</span>
                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-1 border ${pill.cls}`}>
                  {pill.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
