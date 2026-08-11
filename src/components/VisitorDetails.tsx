import React, { useEffect, useState } from 'react';
import { formatDateTime } from '../lib/formatDate';
import { useLiveElapsed } from '../lib/useLiveElapsed';
import { maskIdProof } from '../lib/pii';
import { approvalTimestamp } from '../lib/visitApproval';
import { canRoleShowPass, canShowPass } from '../lib/passVisibility';
import type { ReportVisit } from '../lib/reportRow';
import type { UserRole } from '../types/index';
import VisitorDetailsActions from './VisitorDetailsActions';
import PreApprovalPass from './PreApprovalPass';
import TimelineEntry from './VisitorDetailsTimeline';

interface Props {
  // Widened from `Visit` so callers that have already attached the audit-log
  // approval time can pass it through; plain `Visit` still satisfies this.
  visit: ReportVisit;
  onClose: () => void;
  // Who is looking. Gates the entry pass only — every other detail on this
  // popup is visible to whoever can reach the visit. Omitted means "unknown",
  // which canRoleShowPass treats as a guard and hides the pass.
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
};

function InfoRow({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  if (!value || value === '—') return null;
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-navy-300 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-micro text-navy-500 dark:text-navy-400 uppercase leading-none mb-0.5">{label}</p>
        <p className="text-body font-medium text-navy-800 truncate">{value}</p>
        {/* The department the host belongs to — folded under their name rather
            than kept as its own row, so it is never rendered twice on the
            same card. */}
        {sub && <p className="text-caption text-navy-500 dark:text-navy-400 truncate mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function VisitorDetails({
  visit: v, onClose, viewerRole, acting, reason, onReasonChange, onApprove, onReject,
}: Props) {
  // The popup renders once when it opens, so a snapshot duration sat frozen on
  // screen for as long as the guard kept it open. This one ticks.
  const dur = useLiveElapsed(v.checked_in_at, v.checked_out_at);
  const approvedAt = approvalTimestamp(v);
  const s = STATUS_COLORS[v.status] ?? { bg: 'bg-surface-100', text: 'text-navy-500', dot: 'bg-navy-300' };
  const [showPass, setShowPass] = useState(false);

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
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white backdrop-blur-sm transition-all z-30"
        >
          <svg className="pointer-events-none w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* min-h-0 is load-bearing: without it a flex child refuses to shrink
            below its content and the scrollbar never appears. */}
        <div className="flex-1 min-h-0 overflow-y-auto">

        {/* Header with gradient. The navy scale is INVERTED in dark mode, so
            plain `navy-900/800` — chosen here because they are dark in light
            mode — turn into near-white and swallow the white close button. The
            dark: overrides pin the header to the low end of the flipped scale
            so it stays dark in both themes. */}
        <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-brand-900 dark:from-navy-100 dark:via-navy-200 dark:to-brand-950 px-6 pt-5 pb-14">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(51,150,255,0.2),transparent_70%)]" />
          {/* No ref number here. It is printed on the pass itself, one click
              away under View Pass, which is the copy that matters — the one the
              visitor shows and the guard reads back. Repeating it in the modal
              chrome spent the most prominent line of the popup on a value
              nobody acts on at this point. */}
        </div>

        {/* Profile card overlapping header */}
        <div className="px-5 -mt-10 relative z-10">
          {/* Same inverted-scale trap: `dark:bg-navy-800` rendered a near-white
              card, which the `text-navy-950` name below (also near-white in
              dark) then vanished into. A translucent white lift reads as
              elevated over the glass modal in both themes. */}
          <div className="bg-white dark:bg-white/[0.07] rounded-2xl shadow-elevated p-4 flex gap-4 items-center border border-surface-200/40 dark:border-white/[0.08]">
            {v.photo_url ? (
              <img src={v.photo_url} alt="" className="w-14 h-14 object-cover rounded-xl ring-2 ring-brand-500/20 shrink-0" />
            ) : (
              <div className="w-14 h-14 bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-500/20 dark:to-accent-500/25 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                </svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-h3 text-navy-950 truncate">{v.visitor?.full_name ?? '—'}</p>
              {v.visitor?.vendor_name && <p className="text-caption text-navy-500 dark:text-navy-400 truncate mt-0.5">{v.visitor.vendor_name}</p>}
              <div className="mt-1.5">
                <span className={`status-badge capitalize ${s.bg} ${s.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${v.status === 'checked_in' ? 'animate-pulse' : ''}`} />
                  {v.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Details section */}
        <div className="px-5 pt-5 pb-3">
          <p className="eyebrow mb-3">Details</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            <InfoRow
              label="Phone"
              value={v.visitor?.phone ?? '—'}
              icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>}
            />
            <InfoRow
              label="Person to Meet"
              value={v.host?.full_name ?? '—'}
              sub={v.department?.name}
              icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>}
            />
            <InfoRow
              label="Purpose"
              value={v.purpose ?? '—'}
              icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>}
            />
            {/* The time the HOD booked the visitor for. It is the one field the
                approver chose themselves, and it is what tells anyone reading
                this whether the visitor is early, expected or overdue — none of
                which is answerable from the status alone. Absent for walk-ins,
                which have no scheduled_for by construction, so the row is
                conditional rather than showing a dash on every walk-in. */}
            {v.scheduled_for && (
              <InfoRow
                label="Expected At"
                value={formatDateTime(v.scheduled_for)}
                icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
            )}
            {/* Only when the approver actually named a departure. Its absence is
                the ordinary case and means "no answer given", not "leaves
                immediately" — so no row rather than a dash. When present it is
                the deadline the overstay rule uses. */}
            {v.expected_departure && (
              <InfoRow
                label="Expected Departure"
                value={formatDateTime(v.expected_departure)}
                icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15m-3 0l-3-3m0 0l3-3m-3 3H15" /></svg>}
              />
            )}
          </div>

          {/* An HOD approves on who is visiting and why, never on the ID itself —
              matching a government document to the face in front of it is the
              guard's job at the gate, so the HOD's copy of this popup omits it. */}
          {v.visitor?.id_type && viewerRole !== 'hod' && (
            <div className="mt-3.5">
              <InfoRow
                label="ID Document"
                value={maskIdProof(v.visitor.id_type, v.visitor.id_last4)}
                icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg>}
              />
            </div>
          )}

          {v.carrying_remarks ? (
            <div className="mt-3.5 flex items-start gap-2 text-warning-700 bg-warning-50 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
              <div className="min-w-0">
                <p className="text-caption font-semibold">Carrying</p>
                <p className="text-caption mt-0.5 break-words">{v.carrying_remarks}</p>
              </div>
            </div>
          ) : v.carrying_material ? (
            <div className="mt-3.5 flex items-center gap-2 text-warning-700 bg-warning-50 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
              <span className="text-caption font-semibold">Carrying Material</span>
            </div>
          ) : null}

          {/* Two independent gates, both must pass. canShowPass says the visit
              is at a stage where a pass still means something; canRoleShowPass
              says this viewer may be shown one at all — guards never may, so
              the toggle, the QR and both downloads disappear together for them.
              Everything else on this popup stays visible to a guard: confirming
              a visitor's identity against their record is the whole job. */}
          {canShowPass(v.status) && canRoleShowPass(viewerRole) && (
            <div className="mt-3.5">
              <button
                type="button"
                onClick={() => setShowPass((prev) => !prev)}
                className="w-full text-caption font-bold text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-brand-200 dark:border-brand-500/30 bg-brand-50/60 hover:bg-brand-50 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h4.5v4.5h-4.5v-4.5zM15.75 4.5h4.5v4.5h-4.5v-4.5zM3.75 15.75h4.5v4.5h-4.5v-4.5zM15.75 15.75h1.5v1.5h-1.5v-1.5zM19.5 15.75h.75v.75h-.75v-.75zM15.75 19.5h.75v.75h-.75v-.75zM18.75 18.75h1.5v1.5h-1.5v-1.5z" /></svg>
                {showPass ? 'Hide Pass' : 'View Pass'}
              </button>
              {/* The header card above already shows the photo, name and
                  company; Details shows Person to Meet and the ID. The
                  expanded pass must NOT repeat any of them — it carries only
                  what the popup does not: ref/status, the pass timing and
                  the QR. identityShownElsewhere strips the identity block
                  (and the ID with it) out of PreApprovalPass. */}
              {showPass && <PreApprovalPass visit={v} identityShownElsewhere />}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="mx-5 mt-1 mb-5 rounded-xl bg-surface-50 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.06] p-4">
          <p className="text-[10px] font-bold text-navy-500 dark:text-navy-400 uppercase tracking-wider mb-3">Timeline</p>
          <div className="space-y-3 relative">
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-surface-200 dark:bg-white/10" />

            {approvedAt && <TimelineEntry color="bg-success-400" label="Approved" time={formatDateTime(approvedAt)} />}
            {v.checked_in_at && <TimelineEntry color="bg-brand-500" label="Checked In" time={formatDateTime(v.checked_in_at)} />}
            {v.checked_out_at && <TimelineEntry color="bg-success-500" label="Checked Out" time={formatDateTime(v.checked_out_at)} />}
            {v.checked_in_at && v.status === 'checked_in' && (
              <TimelineEntry
                color={dur.isOvertime ? 'bg-danger-500' : 'bg-brand-400'}
                label="Duration"
                time={`${dur.text}${dur.isOvertime ? ' — Overtime' : ''}`}
                highlight={dur.isOvertime}
                strong
              />
            )}
            {v.rejection_reason && (
              <div className="flex items-start gap-3 relative">
                <div className="w-[11px] h-[11px] rounded-full bg-danger-500 border-2 border-white dark:border-navy-50 shrink-0 mt-0.5 z-10" />
                <div className="flex-1 min-w-0">
                  <span className="text-micro normal-case text-danger-500 font-medium block">Rejection Reason</span>
                  <span className="text-caption text-danger-700 font-medium">{v.rejection_reason}</span>
                </div>
              </div>
            )}
          </div>
        </div>

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
