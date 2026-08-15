import React from 'react';
import { formatStamp } from '../../lib/formatDate';

// One card of "Flagged Visitor Matches" (reference screen 4), styled by
// severity (HIGH red / MEDIUM amber / LOW green — derived, never stored),
// with photo, match reason, clocked time, and the three action buttons
// (Dispatch Security / Notify Admin / Dismiss).

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export type WatchlistMatch = {
  id: string;
  visitId: string;
  name: string;
  reason: string | null;
  photo: string | null;
  time: Date;
  dismissed: boolean;
};

export type WatchlistAction = 'dispatch' | 'notify' | 'dismiss';

export function severityOf(reason: string | null): Severity {
  const r = (reason ?? '').toLowerCase();
  if (/trespass|violent|banned|assault|criminal|danger|threat/i.test(r)) return 'HIGH';
  if (r.trim()) return 'MEDIUM';
  return 'LOW';
}

export const SEVERITY_STYLE: Record<Severity, { border: string; badge: string; text: string; num: string }> = {
  HIGH: { border: 'border-danger-500/50', badge: 'text-danger-400', text: 'text-danger-300', num: 'text-danger-400' },
  MEDIUM: { border: 'border-warning-400/50', badge: 'text-warning-400', text: 'text-warning-300', num: 'text-warning-400' },
  LOW: { border: 'border-success-500/40', badge: 'text-success-500', text: 'text-success-400', num: 'text-success-500' },
};

const initialsOf = (name: string | null | undefined) =>
  ((name ?? 'U').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U');

const AVATAR_FALLBACKS = [
  'linear-gradient(135deg,#991b1b,#dc2626)',
  'linear-gradient(135deg,#7c2d12,#ea580c)',
  'linear-gradient(135deg,#7f1d1d,#f43f5e)',
];

type WatchlistMatchCardProps = {
  row: WatchlistMatch;
  index: number;
  onAct: (row: WatchlistMatch, action: WatchlistAction) => void;
};

export default function WatchlistMatchCard({ row, index, onAct }: WatchlistMatchCardProps): React.ReactElement {
  const sev = severityOf(row.reason);
  const st = SEVERITY_STYLE[sev];

  return (
    <article className={`rounded-2xl border-l-4 ${st.border} border border-surface-200/60 dark:border-white/[0.07] bg-surface-100/40 dark:bg-white/[0.02] p-4`}>
      <header className="flex items-center justify-between mb-3">
        <span className={`flex items-center gap-2 font-display font-bold uppercase tracking-wider text-sm ${st.badge}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Watchlist Match — {sev}
        </span>
      </header>
      <div className="flex items-start gap-4">
        <div
          className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-surface-200/50 dark:border-white/[0.08] flex items-center justify-center"
          style={row.photo ? undefined : { background: AVATAR_FALLBACKS[index % AVATAR_FALLBACKS.length] }}>
          {row.photo ? (
            <img src={row.photo} alt={row.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-display font-bold text-lg">{initialsOf(row.name)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-navy-950 dark:text-white text-lg">{row.name}</p>
          <p className="flex items-center gap-1.5 mt-1 text-xs text-navy-500 dark:text-navy-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            Matched: <span className={st.text}>{row.reason ?? 'On blacklist'}</span>
          </p>
          <p className="flex items-center gap-1.5 mt-1.5 text-xs tabular-nums text-navy-500 dark:text-navy-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatStamp(row.time.toISOString())}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {/* ONE escalation button, not two (2026-08-15).
            "Dispatch Security" and "Notify Admin" both called
            escalateWatchlistMatch() with the same recipients — every admin —
            and differed only in wording. There is no security-dispatch
            mechanism behind the first, so on a security screen it was a promise
            the system cannot keep, the same class of error as the fabricated
            parking slot. Worse, they shared one notification type with no
            per-action key, so pressing the second OVERWROTE the first rather
            than recording both: two labels, one control, one row.
            It is now named for what it actually does. */}
        <button
          onClick={() => void onAct(row, 'notify')}
          className="rounded-lg bg-danger-600 hover:bg-danger-500 text-white text-sm font-semibold px-4 py-2 flex items-center gap-2 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
          </svg>
          Alert Admins
        </button>
        <button
          onClick={() => void onAct(row, 'dismiss')}
          className="rounded-lg border border-surface-200/60 dark:border-white/[0.12] text-navy-600 dark:text-navy-300 hover:bg-surface-100/70 dark:hover:bg-white/[0.05] text-sm font-semibold px-4 py-2 flex items-center gap-2 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Dismiss
        </button>
      </div>
    </article>
  );
}
