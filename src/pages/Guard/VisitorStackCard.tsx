import React from 'react';
import type { Visit } from '../../types/index';
import { STATUS_STYLES } from '../../lib/statusStyles';
import { railFor } from '../../lib/statusRail';
import VisitorStackFacts from './VisitorStackFacts';

export type StackAction = { label: string; onClick: () => void; disabled?: boolean };

type Props = {
  visit: Visit;
  /** Primary action, e.g. Check In / Check Out. Rendered as a 44px target. */
  action?: StackAction;
  /** Opens the detail sheet. Rendered as the "Details" secondary control. */
  onSelect?: (visit: Visit) => void;
};

// The stacked visitor card. Three columns inside one wide card:
//
//   identity  |  contact facts  |  verification + action
//
// The split follows the order a guard actually works in. They read the name and
// who the visitor is here to see, glance at the time and the phone to confirm
// it is the right person, then act. Cramming those into one line — which the
// old single-row .visitor-card did — meant the guard re-read the whole row to
// find any one of them.
//
// Exactly one loud line per card (the visitor's name). Status is carried by the
// leading colour rail AND the text badge, never colour alone: the gate terminal
// is read in glare, and colour-only encoding fails colour-blind guards too.
export default function VisitorStackCard({ visit: v, action, onSelect }: Props): React.ReactElement {
  const style = STATUS_STYLES[v.status];

  return (
    <article className={`stack-card ${railFor(v.status)}`}>
      {/* ── Identity ─────────────────────────────────────────────── */}
      <div className="stack-card-identity">
        <div className="stack-photo-well">
          {v.photo_url ? (
            <img src={v.photo_url} alt="" className="stack-photo" />
          ) : (
            <div className="stack-photo stack-photo-empty" aria-hidden="true">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
              </svg>
            </div>
          )}
          <span className={`stack-photo-tag ${v.photo_url ? '' : 'stack-photo-tag-muted'}`}>
            {v.photo_url ? 'Photo' : 'No photo'}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="stack-name">{v.visitor?.full_name ?? 'Unknown visitor'}</p>
          {v.visitor?.vendor_name && <p className="stack-vendor">{v.visitor.vendor_name}</p>}

          <dl className="stack-attrs">
            {/* The host's name only. The department used to trail it in
                brackets AND have its own row below — the same value twice on
                one card, which CLAUDE.md forbids and which made the eye check
                whether the two agreed. */}
            <StackAttr icon={ICON_PERSON} term="Visiting">
              {v.host?.full_name ?? '—'}
            </StackAttr>
            <StackAttr icon={ICON_CLIPBOARD} term="Purpose">{v.purpose ?? '—'}</StackAttr>
            {v.department?.name && (
              <StackAttr icon={ICON_BUILDING} term="Department">{v.department.name}</StackAttr>
            )}
          </dl>
        </div>
      </div>

      {/* ── Contact facts ────────────────────────────────────────── */}
      <VisitorStackFacts visit={v} />

      {/* ── Verification + action ────────────────────────────────── */}
      <div className="stack-card-action">
        <span className={`status-badge self-start ${style.bg} ${style.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>

        <div className="space-y-1 mt-2.5">
          <StackCheck ok={v.status !== 'pending_approval'}>
            {v.status === 'pending_approval' ? 'Awaiting approval' : 'Approved'}
          </StackCheck>
          <StackCheck ok={Boolean(v.visitor?.id_type)}>
            {v.visitor?.id_type
              ? `ID Proof: ${v.visitor.id_type}${v.visitor.id_last4 ? ` ••${v.visitor.id_last4}` : ''}`
              : 'ID Proof: not captured'}
          </StackCheck>
        </div>

        <div className="mt-auto pt-3 flex items-center gap-2">
          {action && (
            <button type="button" className="gate-action flex-1" disabled={action.disabled}
              onClick={action.onClick}>
              {action.label}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          )}
          {onSelect && (
            <button type="button" className="gate-action-ghost" onClick={() => onSelect(v)}
              aria-label={`Details for ${v.visitor?.full_name ?? 'visitor'}`}>
              Details
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

const ICON_PERSON = 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z';
const ICON_CLIPBOARD = 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z';
const ICON_BUILDING = 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21';

function StackAttr({ icon, term, children }: { icon: string; term: string; children: React.ReactNode }) {
  return (
    <div className="stack-attr">
      <svg className="stack-attr-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <dt className="stack-attr-term">{term}:</dt>
      <dd className="stack-attr-value">{children}</dd>
    </div>
  );
}

// A tick and a cross, each with its own words. The mark is never the only
// carrier — "ID Proof: Aadhaar ✓" and "ID Proof: not captured ✗" read the same
// in greyscale, which a green-only tick does not.
function StackCheck({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p className={`stack-check ${ok ? 'stack-check-ok' : 'stack-check-missing'}`}>
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round"
          d={ok ? 'M4.5 12.75l6 6 9-13.5' : 'M6 18L18 6M6 6l12 12'} />
      </svg>
      <span className="truncate">{children}</span>
    </p>
  );
}
