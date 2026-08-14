import React from 'react';
import { Link } from 'react-router-dom';

// Quick launchers for the two things a guard actually starts from the
// dashboard. The reference design shipped four buttons; two are deliberately
// absent and must stay that way:
//   - "Issue Pass" — CLAUDE.md's guard-surface rule is that a guard must never
//     be able to mint an entry pass (see lib/passVisibility.ts and the note at
//     the top of Console.tsx). Adding it back here would reopen that hole from
//     a new corner of the app.
//   - "Report Incident" — there is no incidents table, page or route anywhere
//     in this codebase. A button with nowhere to go is a dead end, not a
//     feature.
// Both surviving actions are real routed pages (see roleRoutes.ts /
// App.tsx), not placeholders.

type QuickAction = {
  to: string;
  label: string;
  subtitle: string;
  iconColorClass: string;
  icon: React.ReactNode;
};

// "Person with a plus" — registering someone new at the gate.
const ICON_WALKIN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true" className="w-7 h-7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.75 19.125a6.25 6.25 0 0112.5 0" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 8.25v6M15.75 11.25h6" />
  </svg>
);

// QR-code glyph — matches the scan-desk grid mark used elsewhere in the app.
const ICON_SCAN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true" className="w-7 h-7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h4.5v4.5h-4.5v-4.5zM15.75 4.5h4.5v4.5h-4.5v-4.5zM3.75 15.75h4.5v4.5h-4.5v-4.5zM15.75 15.75h1.5v1.5h-1.5v-1.5zM19.5 15.75h.75v.75h-.75v-.75zM15.75 19.5h.75v.75h-.75v-.75zM18.75 18.75h1.5v1.5h-1.5v-1.5z" />
  </svg>
);

const ACTIONS: QuickAction[] = [
  {
    to: '/visitors/walk-in',
    label: 'Walk-in Visitor',
    subtitle: 'Register new visitor',
    iconColorClass: 'text-brand-600',
    icon: ICON_WALKIN,
  },
  {
    to: '/guard/scan-pass',
    label: 'Scan QR',
    subtitle: 'Verify a visitor pass',
    iconColorClass: 'text-accent-600 dark:text-accent-300',
    icon: ICON_SCAN,
  },
];

export default function DashboardQuickActions(): React.ReactElement {
  return (
    <section className="card-premium overflow-hidden">
      <div className="px-5 pt-4 pb-3.5 border-b border-surface-100 dark:border-white/[0.06]">
        <h2 className="revamp-section-head mb-0">
          <span className="revamp-section-rule" aria-hidden="true" />
          <span className="revamp-section-title">Quick Actions</span>
        </h2>
      </div>

      <div className="p-5 grid grid-cols-2 gap-4">
        {ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            // min-h keeps every tile a comfortable tap target on a gate
            // terminal, not just tall enough to clear its own content.
            className="min-h-[110px] flex flex-col items-center justify-center gap-2 rounded-2xl border border-surface-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-4 py-5 text-center transition-all hover:border-brand-500/40 hover:shadow-glow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2"
          >
            <span className={action.iconColorClass}>{action.icon}</span>
            <span className="text-sm font-bold text-navy-950 dark:text-white">{action.label}</span>
            <span className="text-xs text-navy-500 dark:text-navy-400">{action.subtitle}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
