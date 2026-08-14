import React from 'react';
import { Link } from 'react-router-dom';
import type { ReportVisit } from '../../lib/reportRow';
import { recentActivity, type ActivityEvent, type ActivityKind } from '../../lib/recentActivity';
import { formatTime } from '../../lib/formatDate';

type Props = {
  /** The whole day, unfiltered — this panel derives its own feed from it so it
   *  can never disagree with the KPI tiles reading the same array. */
  visits: ReportVisit[];
  loading: boolean;
  onSelect: (visit: ReportVisit) => void;
};

/** Per-kind colour + glyph. A lookup map rather than an if/else chain, per the
 *  "no fuzzy matching on known enums" rule — a fourth kind is a compile error
 *  here, not a silently-unstyled row. Colours are this app's Quest Mall
 *  gold/bronze tokens, not the blue/green/red of the reference design. */
const KIND_META: Record<ActivityKind, {
  text: string; tint: string; badge: string; path: string;
}> = {
  entry: {
    text: 'text-success-700', tint: 'bg-success-100', badge: 'ENTRY',
    // Arrow into the building: pointing right.
    path: 'M4.5 12h15m0 0l-5.25-5.25M19.5 12l-5.25 5.25',
  },
  exit: {
    text: 'text-navy-600', tint: 'bg-navy-200', badge: 'EXIT',
    // Arrow out of the building: pointing left.
    path: 'M19.5 12h-15m0 0l5.25-5.25M4.5 12l5.25 5.25',
  },
  declined: {
    text: 'text-danger-700', tint: 'bg-danger-100', badge: 'DECLINED',
    // No direction to a decline — an X reads clearer than an arrow.
    path: 'M6 18L18 6M6 6l12 12',
  },
};

/** Second line under the name: what the visitor represents, in the same
 *  fallback order the reports register uses — vendor, then the department
 *  they were headed to, then a bare label rather than leaving the line blank. */
function subLabel(visit: ReportVisit): string {
  return visit.visitor?.vendor_name || visit.department?.name || 'Visitor';
}

function ActivityRow({ event, onSelect }: { event: ActivityEvent; onSelect: (v: ReportVisit) => void }): React.ReactElement {
  const meta = KIND_META[event.kind];
  const name = event.visit.visitor?.full_name ?? 'Visitor';
  return (
    <button
      type="button"
      onClick={() => onSelect(event.visit)}
      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-surface-50 dark:hover:bg-white/[0.04] transition-colors"
    >
      <span className="w-14 shrink-0 text-xs font-semibold tabular-nums text-navy-500 dark:text-navy-400">
        {formatTime(event.at)}
      </span>
      <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${meta.tint} ${meta.text}`}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={meta.path} />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-navy-950 dark:text-white truncate">{name}</span>
        <span className="block text-xs text-navy-500 dark:text-navy-400 truncate">{subLabel(event.visit)}</span>
      </span>
      <span className={`shrink-0 text-[10px] font-bold tracking-wide ${meta.text}`}>{meta.badge}</span>
    </button>
  );
}

// The Recent Activity panel, reinstated on the guard dashboard. It was
// deleted once because it ran its own fetch alongside the KPI tiles; this
// version is a pure derivation of the `visits` the dashboard already loaded
// (see lib/recentActivity.ts), so the feed and the counts above it read the
// same day and cannot disagree.
export default function DashboardActivity({ visits, loading, onSelect }: Props): React.ReactElement {
  const events = recentActivity(visits);

  return (
    <section className="card-premium overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3.5 border-b border-surface-100 dark:border-white/[0.06]">
        <h2 className="revamp-section-head mb-0">
          <span className="revamp-section-rule" aria-hidden="true" />
          <span className="revamp-section-title">Recent Activity</span>
        </h2>
        <Link to="/visitors" className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
          View all
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      </div>

      {loading ? (
        <div className="p-5 flex flex-col gap-3">
          {[0, 1].map((i) => <div key={i} className="skeleton h-12 w-full rounded-xl" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="revamp-empty px-5">
          <div className="revamp-empty-medallion">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
          </div>
          <p className="revamp-empty-title">Nothing at the gate yet</p>
          <p className="revamp-empty-sub">Entries, exits and declines will appear here as soon as the first visitor arrives.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-surface-100 dark:divide-white/[0.06]">
          {events.map((event) => (
            <ActivityRow key={event.id} event={event} onSelect={onSelect} />
          ))}
        </div>
      )}

      <Link
        to="/visitors"
        className="flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-navy-600 dark:text-navy-400 border-t border-surface-100 dark:border-white/[0.06] hover:bg-surface-50 dark:hover:bg-white/[0.04] transition-colors"
      >
        Go to Visitor Log
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Link>
    </section>
  );
}
