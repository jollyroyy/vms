import React from 'react';

import { Link } from 'react-router-dom';

import type { ReportVisit } from '../../lib/reportRow';
import { istDateKey } from '../../lib/visitExpiry';

// One visitor card of the Pre-Registered Arrivals grid (reference screen 3):
// circular headshot, name, company, host, clocked time, and the
// ARRIVED / EXPECTED / MISSED / LATE pill. Tapping opens the visit in the
// Live Queue for quick check-in.

export type PreRegisteredPill = { label: string; cls: string };

export const AVATAR_FALLBACKS = [
  'linear-gradient(135deg,#1d4ed8,#3b82f6)',
  'linear-gradient(135deg,#6d28d9,#8b5cf6)',
  'linear-gradient(135deg,#0e7490,#06b6d4)',
  'linear-gradient(135deg,#be185d,#ec4899)',
  'linear-gradient(135deg,#047857,#10b981)',
  'linear-gradient(135deg,#b45309,#f59e0b)',
];

type PreRegisteredCardProps = {
  visit: ReportVisit;
  index: number;
  pill: PreRegisteredPill;
  /** Start the check-in for this visitor. Omitted, the card is read-only. */
  onCheckIn?: (visit: ReportVisit) => void;
};

// Which visits this card may act on. A guard can only admit someone an approver
// has cleared and who is not already through the gate — an ARRIVED card offers
// nothing, because there is nothing left to do to it. Deliberately narrow: a
// button the guard cannot honour is worse than no button.
const CAN_ENTER: Partial<Record<string, true>> = { approved: true, walkin_approved: true };

export function isCheckInReady(visit: ReportVisit): boolean {
  return CAN_ENTER[visit.status] === true && !visit.checked_in_at;
}

// A bare time on a board that now holds EVERY pre-registration ever made says
// when but not whether that when is today — the exact confusion CLAUDE.md
// removed from every other `scheduled_for` line in the app. Today's cards keep
// the compact time the reference frames; anything else carries its date.
function slotLabel(visit: ReportVisit): string {
  const when = new Date(visit.scheduled_for ?? visit.created_at);
  if (Number.isNaN(when.getTime())) return '—';
  const time = when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (istDateKey(when) === istDateKey(new Date())) return time;
  return `${when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
}

const initialsOf = (name: string | null | undefined) =>
  ((name ?? 'U').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U');

export default function PreRegisteredCard({ visit, index, pill, onCheckIn }: PreRegisteredCardProps): React.ReactElement {
  const ready = onCheckIn !== undefined && isCheckInReady(visit);

  // The card used to be one big <Link> to /guard/inside-now?verify=… — which
  // lists only checked_in visitors, so tapping a WAITING or EXPECTED card
  // navigated to a page that did not contain them. The link now covers the
  // identity block only (and only for someone who IS on that page), and the
  // action a guard actually wants at the gate is a real button on the face of
  // the card. A <button> cannot live inside an <a>, hence the div root.
  return (
    <div className="rounded-2xl border border-surface-200/60 dark:border-white/[0.07] bg-surface-100/60 dark:bg-white/[0.03] p-4 hover:border-brand-500/40 hover:bg-brand-600/5 transition-colors">
      <CardBody visit={visit} index={index} pill={pill} />
      {ready && (
        <button
          type="button"
          onClick={() => onCheckIn(visit)}
          className="mt-3 w-full rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm py-2.5 transition-colors flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h5a3 3 0 013 3v1" />
          </svg>
          Check In
        </button>
      )}
    </div>
  );
}

function CardBody({ visit, index, pill }: Omit<PreRegisteredCardProps, 'onCheckIn'>): React.ReactElement {
  const inside = visit.status === 'checked_in';
  const Wrapper = inside ? Link : 'div';
  const wrapperProps = inside ? { to: `/guard/inside-now?verify=${visit.id}` } : {};
  return (
    <Wrapper {...(wrapperProps as never)} className="block">
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 shrink-0 rounded-full overflow-hidden border-2 border-surface-200/50 dark:border-white/[0.08] flex items-center justify-center"
          style={visit.photo_path ? undefined : { background: AVATAR_FALLBACKS[index % AVATAR_FALLBACKS.length] }}>
          {visit.photo_path ? (
            <img src={visit.photo_path} alt={visit.visitor?.full_name ?? 'Visitor'} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-display font-bold text-base">{initialsOf(visit.visitor?.full_name)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-display font-semibold text-navy-950 dark:text-white truncate">{visit.visitor?.full_name ?? 'Unknown'}</p>
          <p className="text-sm text-navy-500 dark:text-navy-400 truncate">{visit.visitor?.vendor_name ?? '—'}</p>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-navy-500 dark:text-navy-400">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
        </svg>
        Host: {visit.host?.full_name ?? visit.department?.name ?? '—'}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs tabular-nums text-navy-700 dark:text-navy-200">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {slotLabel(visit)}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-1 border ${pill.cls}`}>{pill.label}</span>
      </div>
    </Wrapper>
  );
}
