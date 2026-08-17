import React, { useEffect, useState } from 'react';
import { useLiveElapsed } from '../lib/useLiveElapsed';
import { approvalTimestamp } from '../lib/visitApproval';
import type { ReportVisit } from '../lib/reportRow';
import type { UserRole } from '../types/index';
import VisitorDetailsActions from './VisitorDetailsActions';
import VisitorDetailsOverview from './VisitorDetailsOverview';
import VisitorDetailsIdCard, { isIdentityVerified } from './VisitorDetailsIdCard';
import { VisitorTimelineCard } from './VisitorDetailsTimeline';

interface Props {
  // Widened from `Visit` so callers that have already attached the audit-log
  // approval time can pass it through; plain `Visit` still satisfies this.
  visit: ReportVisit;
  onClose: () => void;
  // Who is looking. Gates the entry pass, the ID proof (hidden from an HOD)
  // and the Timeline (hidden from a guard, 2026-08-13); every other detail on
  // this popup is visible to whoever can reach the visit. Omitted means
  // "unknown", which canRoleShowPass treats as a guard and hides the pass —
  // but NOT the Timeline, which only an explicit `guard` drops, so a caller
  // that never states a role keeps the fuller popup.
  viewerRole?: UserRole | null;
  acting?: string | null;
  reason?: string;
  onReasonChange?: (value: string) => void;
  onApprove?: () => void;
  onReject?: () => void;
}

// Every tint here must resolve through a CSS-variable token (navy/surface/
// brand-50/100 and the status -50/-700 pairs), because those are the only
// shades that flip with the theme. A static Tailwind pair like
// `bg-orange-50 text-orange-700` stays a light chip on a dark modal — hence
// no_show borrows the warning tokens and separates itself by its dot.
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  pending_approval: { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500' },
  approved:         { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500' },
  walkin_approved:  { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500' },
  checked_in:       { bg: 'bg-brand-50',   text: 'text-brand-700 dark:text-brand-300', dot: 'bg-brand-500' },
  checked_out:      { bg: 'bg-surface-100', text: 'text-navy-600',   dot: 'bg-navy-400' },
  rejected:         { bg: 'bg-danger-50',  text: 'text-danger-700',  dot: 'bg-danger-500' },
  cancelled:        { bg: 'bg-surface-100', text: 'text-navy-500',   dot: 'bg-navy-300' },
  no_show:          { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-orange-500' },
  // Both are closed-without-arriving but neither is an incident: a pass granted
  // and unused, and a request nobody answered. Muted, like cancelled.
  expired:          { bg: 'bg-surface-100', text: 'text-navy-500',   dot: 'bg-navy-300' },
  lapsed:           { bg: 'bg-surface-100', text: 'text-navy-500',   dot: 'bg-navy-300' },
};

// Two tabs, not three. The Timeline stays BELOW both rather than becoming one,
// because it is the same visit's clock in either view and a guard reading the
// ID should not lose sight of when the visitor arrived.
type Tab = 'overview' | 'id';

export default function VisitorDetails({
  visit: v, onClose, viewerRole, acting, reason, onReasonChange, onApprove, onReject,
}: Props) {
  // The popup renders once when it opens, so a snapshot duration sat frozen on
  // screen for as long as the guard kept it open. This one ticks.
  const dur = useLiveElapsed(v.checked_in_at, v.checked_out_at);
  const approvedAt = approvalTimestamp(v);
  const s = STATUS_COLORS[v.status] ?? { bg: 'bg-surface-100', text: 'text-navy-500', dot: 'bg-navy-300' };
  const [tab, setTab] = useState<Tab>('overview');

  // An HOD approves on who is visiting and why, never on the ID itself —
  // matching a government document to the face in front of it is the guard's
  // job at the gate. So the HOD's copy has no ID tab at all, rather than a tab
  // that opens onto a refusal.
  const showIdTab = viewerRole !== 'hod';

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      {/* `!overflow-hidden` + an inner scroller, rather than letting
          .modal-content scroll itself. The close button used to sit inside that
          scrolling box, which cost it twice on the guard's copy of this popup —
          the tallest one, since a guard also sees the ID document, the timeline
          and the pass. It scrolled out of reach as soon as the content moved,
          and at rest its right edge sat under the scrollbar gutter, so the cross
          was never fully visible. Outside the scroller it is fixed to the modal
          and always whole. */}
      <div
        className="modal-content sm:max-w-lg !overflow-hidden relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sibling of the scroll area, not a child of it. z-30 keeps it above
            the profile card, which is pulled up with -mt-10 at z-10 and would
            otherwise swallow the click. */}
        <button
          type="button"
          aria-label="Close"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          // Neutral, not white-on-navy: there is no dark banner behind it any
          // more, so a white cross would have been invisible in light mode. One
          // token step, no `dark:` pair — the navy scale flips on its own.
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-navy-950/[0.06] dark:bg-white/[0.08] hover:bg-navy-950/10 dark:hover:bg-white/[0.14] text-navy-800 transition-all z-30"
        >
          <svg className="pointer-events-none w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* min-h-0 is load-bearing: without it a flex child refuses to shrink
            below its content and the scrollbar never appears. */}
        <div className="flex-1 min-h-0 overflow-y-auto">

        {/* LIGHT THEME ONLY: the identity band is tinted (client report,
            2026-08-16). The 2026-08-15 fix below flattened this row onto the
            modal's own glass, which is right in dark mode — the complaint then
            was a LIGHT patch sitting behind the visitor's name on a dark panel.
            In light mode the same flattening left the photo and the name on
            white-on-white with only a hairline under them, so the one thing the
            popup opens with had no edge at all. `dark:bg-transparent` keeps dark
            mode exactly as the client accepted it; only the light end gains the
            step. Everything below is unchanged.

            ONE SURFACE, top to bottom (client report, 2026-08-15). This used to
            open with a navy→brand gradient band carrying a radial highlight,
            with a white profile card lifted onto it — three tones stacked in
            the first 120px of the popup. In dark mode that read as a light
            patch behind the visitor's name on an otherwise dark panel, which is
            what the client saw. Nothing above the tabs paints a background now:
            the header row IS the modal's own glass, and the photo, the name and
            the status pill sit directly on it, separated from the tabs by a
            hairline rather than by a change of colour. `pr-14` keeps the row
            clear of the close button, which is out of the flow (56px, the
            arithmetic in CLAUDE.md).

            No ref number here either. It is printed on the pass itself, one
            click away under View Pass — the copy the visitor shows and the
            guard reads back. */}
        <div className="px-5 pt-5 pb-4 pr-14 flex gap-4 items-center border-b border-surface-200/70 dark:border-white/[0.07] bg-surface-100/70 dark:bg-transparent">
          {v.photo_url ? (
            <img src={v.photo_url} alt="" className="w-14 h-14 object-cover rounded-xl ring-2 ring-brand-500/30 dark:ring-brand-500/20 shrink-0 shadow-soft" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-navy-950/[0.07] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-h3 font-bold text-navy-950 truncate">{v.visitor?.full_name ?? '—'}</p>
            {v.visitor?.vendor_name && <p className="text-caption text-navy-600 truncate mt-0.5">{v.visitor.vendor_name}</p>}
            <div className="mt-1.5">
              <span className={`status-badge capitalize ${s.bg} ${s.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${v.status === 'checked_in' ? 'animate-pulse' : ''}`} />
                {v.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Tab bar. A segmented control, not links: this popup is one record
            and the tabs are two readings of it. The ID tab exists because "what
            document did we take, and does the face match" is the question a
            guard is later asked to account for, and it used to be one masked
            line between Purpose and Carrying. */}
        <div className="px-5 pt-4">
          <div role="tablist" aria-label="Visitor details" className="flex gap-1 p-1 rounded-xl bg-surface-100 dark:bg-white/[0.05]">
            {([
              ['overview', 'Overview'],
              ...(showIdTab ? [['id', 'ID & Photo'] as const] : []),
            ] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex-1 rounded-lg px-3 py-2 text-caption font-bold transition-all ${
                  tab === key
                    ? 'bg-white dark:bg-white/[0.12] text-navy-950 shadow-soft'
                    : 'text-navy-600 hover:text-navy-800'
                }`}
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  {label}
                  {/* A tick on the tab itself, so the answer is visible without
                      opening it — and only when it is genuinely true. */}
                  {key === 'id' && isIdentityVerified(v) && (
                    <svg className="w-3.5 h-3.5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        {tab === 'overview'
          ? <VisitorDetailsOverview visit={v} viewerRole={viewerRole} />
          : <VisitorDetailsIdCard visit={v} />}


        {/* Timeline, split in two since 2026-08-17 (client instruction: a
            scanned record must show "what time he checked in").
            - ARRIVAL — checked in at, checked out at — is shown to EVERY role.
            - AUDIT — approval time, elapsed duration — is still hidden from a
              guard, which is what survives of the 2026-08-13 instruction.
            The rejection reason is gated by neither; see VisitorTimelineCard. */}
        <VisitorTimelineCard
          visit={v}
          approvedAt={approvedAt}
          duration={dur}
          showAudit={viewerRole !== 'guard'}
          showArrival
        />

        <VisitorDetailsActions
          visit={v}
          busy={acting === v.id}
          reason={reason ?? ''}
          onReasonChange={onReasonChange}
          onApprove={onApprove}
          onReject={onReject}
        />
        </div>
      </div>
    </div>
  );
}
