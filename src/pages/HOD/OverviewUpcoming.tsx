import React, { useState } from 'react';
import type { Visit } from '../../types/index';
import VisitorDetails from '../../components/VisitorDetails';

const PURPOSE_LABELS: Record<string, string> = {
  meeting: 'Meeting', vendor: 'Vendor', interview: 'Interview',
  delivery: 'Delivery', maintenance: 'Maintenance', audit: 'Audit', other: 'Other',
};

// The two HOD approval routes are named apart, rather than both reading
// "Pre-Approved": 'approved' is a pre-approval raised before the visit,
// 'walkin_approved' is an on-the-spot approval of someone already at the gate.
// Direct lookup keyed by status — never a ternary chain over the enum.
type UpcomingBadge = { label: string; cls: string; awaitingGate: boolean };

const PENDING_BADGE: UpcomingBadge = {
  label: 'Pending',
  cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25',
  awaitingGate: false,
};

const UPCOMING_BADGES: Record<string, UpcomingBadge> = {
  pending_approval: PENDING_BADGE,
  approved: {
    label: 'Pre-approved',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25',
    awaitingGate: true,
  },
  walkin_approved: {
    label: 'Walk-in approved',
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/25',
    awaitingGate: true,
  },
};

type Props = {
  loading: boolean;
  upcoming: Visit[];
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtTime24 = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function OverviewUpcoming({ loading, upcoming }: Props): React.ReactElement {
  // "Open details" used to be a blanket <Link to="/approvals">, which carries
  // no visitor identity — for an HOD with nothing pending it silently landed
  // on the empty pre-approve FORM, reading as a dead button. It now opens the
  // CLICKED row's own VisitorDetails popup in place; nothing navigates.
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);

  return (
    <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-surface-200/70 dark:border-white/[0.06] overflow-hidden">
      {detailVisit && (
        <VisitorDetails
          visit={detailVisit}
          viewerRole="hod"
          onClose={() => setDetailVisit(null)}
        />
      )}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-surface-100 dark:border-white/[0.05]">
        <div>
          <h2 className="font-display text-sm font-bold text-navy-950 dark:text-white">Upcoming visits</h2>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-0.5">
            Pending &amp; pre-approved · up to 30 days ahead, max 15 entries
          </p>
        </div>
        {!loading && (
          <span className="text-[11px] font-bold text-navy-500 dark:text-navy-400 bg-surface-100 dark:bg-white/[0.06] px-3 py-1.5 rounded-full">
            {upcoming.length} visit{upcoming.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-6 space-y-4">
          {[0, 1, 2].map(i => <div key={i} className="skeleton h-[72px] w-full rounded-xl" />)}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="py-14 px-6 flex flex-col items-center text-center">
          <svg className="w-10 h-10 text-surface-300 dark:text-navy-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
          </svg>
          <p className="text-sm font-semibold text-navy-500 dark:text-navy-400">No upcoming visits</p>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">Scheduled and pre-approved visits will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-surface-100 dark:divide-white/[0.04]">
          {upcoming.map((v) => {
            const when = v.scheduled_for ?? v.created_at;
            const timeStr = fmtTime24(when);
            const dateStr = fmtDate(when).slice(0, 5);
            const badge = UPCOMING_BADGES[v.status] ?? PENDING_BADGE;
            return (
              <div key={v.id} className="flex items-stretch hover:bg-surface-50/80 dark:hover:bg-white/[0.02] transition-colors">
                <div className="shrink-0 w-[72px] flex flex-col items-center justify-center py-4 px-2">
                  <span className="font-display font-bold text-[15px] text-navy-900 dark:text-white tabular-nums leading-none">{timeStr}</span>
                  <span className="text-[11px] text-navy-500 dark:text-navy-400 mt-0.5 tabular-nums">{dateStr}</span>
                </div>
                <div className="w-px bg-surface-200/70 dark:bg-white/[0.07] self-stretch my-3 shrink-0" />
                <div className="flex-1 min-w-0 py-4 px-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    {/* THE VISITOR LEADS. This card used to open with
                        "{Purpose} — {Vendor}", which read as one compound label
                        rather than as two separate facts: a live row whose
                        vendor_name happened to name a kind of pass rendered as
                        "Delivery — <that text>" and looked like a system label
                        for the pass itself, not like someone's employer. The
                        person is the headline; purpose is a chip below. */}
                    <div className="min-w-0 flex-1">
                      <p className="eyebrow !text-[10px] text-navy-400 dark:text-navy-500 mb-1">Visitor Pass</p>
                      <p className="font-display font-bold text-[15px] text-navy-950 dark:text-white leading-snug truncate">
                        {v.visitor?.full_name ?? '—'}
                      </p>
                      {/* Vendor appears here and NOWHERE else on the card. It
                          used to be printed twice — once against the purpose and
                          again as a chip below, alongside a second copy of the
                          visitor's name. */}
                      {v.visitor?.vendor_name && (
                        <p className="text-xs text-navy-500 dark:text-navy-400 truncate mt-0.5">{v.visitor.vendor_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
                      {/* Both approval routes converge here: the HOD has decided,
                          the gate has not checked the visitor in yet. */}
                      {badge.awaitingGate && (
                        <span className="text-[10px] font-semibold text-navy-500 dark:text-navy-400 whitespace-nowrap">
                          Awaiting gate check
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setDetailVisit(v)}
                        className="text-[11px] font-semibold text-navy-600 dark:text-navy-300 bg-surface-100 dark:bg-white/[0.06] hover:bg-surface-200 dark:hover:bg-white/[0.10] border border-surface-200 dark:border-white/[0.08] px-3 py-1 rounded-lg transition-colors whitespace-nowrap">
                        Open details
                      </button>
                    </div>
                  </div>

                  {/* Person to Meet, promoted out of the muted 12px run-on it
                      used to share with the department. This is the field that
                      tells an HOD whether the visit is theirs to care about, so
                      it gets its own tinted block and the host's name is set at
                      the same weight as the visitor's. */}
                  <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-surface-200/70 dark:border-white/[0.07] bg-surface-50/80 dark:bg-white/[0.03] px-3 py-2">
                    <svg className="w-4 h-4 shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-navy-400 dark:text-navy-500 leading-none">Person to Meet</p>
                      <p className="font-semibold text-sm text-navy-900 dark:text-white truncate mt-1 leading-none">
                        {v.host?.full_name ?? '—'}
                      </p>
                      {v.department?.name && (
                        <p className="text-xs text-navy-500 dark:text-navy-400 truncate mt-1 leading-none">{v.department.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <span className="inline-flex items-center text-[11px] font-medium bg-surface-100 dark:bg-white/[0.06] text-navy-600 dark:text-navy-300 px-2.5 py-0.5 rounded-full border border-surface-200/70 dark:border-white/[0.08]">
                      {PURPOSE_LABELS[v.purpose] ?? v.purpose}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
