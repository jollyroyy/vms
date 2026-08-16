import React from 'react';
import type { Visit } from '../../types/index';
import { STATUS_STYLES } from '../../lib/statusStyles';
import { formatDateTime } from '../../lib/formatDate';
import { visitOrigin, visitOriginLabel, statusProvesOrigin } from '../../lib/visitOrigin';

// The Visitors card, in the reference console's card language.
//
// It replaced the three-column stacked row (VisitorStackCard). The row was not
// wrong, it was just a second card design: a guard moving between Pre-Registered
// and Visitors met the same visitor drawn two different ways and had to re-learn
// where the name, the host and the button were on each. This is the same face as
// PreRegisteredCard — circular headshot, name, vendor, host line, time, status
// pill — so the whole guard surface now has one visitor card.
//
// What carries over from the stacked card, deliberately:
//   · NO leading colour rail. Status is the text pill, which survives glare and
//     colour-blindness; colour is never the only carrier.
//   · NO "Details" control. The card IS the record, and the sheet behind that
//     button was a second place to read the same visit. Looking a visitor UP is
//     /guard/search and /whos-inside; here the job is the person at the gate.
//   · NO action, ever (client instruction, 2026-08-14). The Visitors tab only
//     shows which visitor falls under which category; check-in and check-out
//     happen on their own desks (Scan Pass / Pre-Approvals for entry, Inside
//     Now for exit), never from a card in a category list.
//   · The department appears ONCE. It used to trail the host in brackets AND own
//     its own row, which made the eye check whether the two agreed.
//   · An expected time is always DATE AND TIME. These lists are never
//     date-bounded, so a bare "03:30" says when but not whether that when is now.

export const AVATAR_FALLBACKS = [
  'linear-gradient(135deg,#1d4ed8,#3b82f6)',
  'linear-gradient(135deg,#6d28d9,#8b5cf6)',
  'linear-gradient(135deg,#0e7490,#06b6d4)',
  'linear-gradient(135deg,#be185d,#ec4899)',
  'linear-gradient(135deg,#047857,#10b981)',
  'linear-gradient(135deg,#b45309,#f59e0b)',
];

type Props = {
  visit: Visit;
  index: number;
};

const initialsOf = (name: string | null | undefined) =>
  ((name ?? 'U').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U');

/** The moment this card should print: when they left, else when they came in,
 *  else when they are due, else when the row was raised. */
function stampOf(v: Visit): { label: string; iso: string } {
  if (v.checked_out_at) return { label: 'Left', iso: v.checked_out_at };
  if (v.checked_in_at) return { label: 'In', iso: v.checked_in_at };
  if (v.scheduled_for) return { label: 'Expected', iso: v.scheduled_for };
  return { label: 'Raised', iso: v.created_at };
}

export default function VisitorGridCard({ visit: v, index }: Props): React.ReactElement {
  const photo = v.photo_data ?? v.photo_path ?? null;
  const name = v.visitor?.full_name ?? 'Unknown';
  const status = STATUS_STYLES[v.status];
  const stamp = stampOf(v);

  return (
    <div className="rounded-2xl border border-surface-200/60 dark:border-white/[0.07] bg-surface-100/60 dark:bg-white/[0.03] p-4 hover:border-brand-500/40 hover:bg-brand-600/5 transition-colors flex flex-col">
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 shrink-0 rounded-full overflow-hidden border-2 border-surface-200/50 dark:border-white/[0.08] flex items-center justify-center"
          style={photo ? undefined : { background: AVATAR_FALLBACKS[index % AVATAR_FALLBACKS.length] }}>
          {photo ? (
            <img src={photo} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-display font-bold text-base">{initialsOf(name)}</span>
          )}
        </div>
        <div className="min-w-0">
          {/* Exactly one loud line per card. */}
          <p className="font-display font-semibold text-navy-950 dark:text-white truncate">{name}</p>
          <p className="text-sm text-navy-500 dark:text-navy-400 truncate">{v.visitor?.vendor_name ?? '—'}</p>
        </div>
      </div>

      {/* Host and department on one line — the department is NOT repeated below. */}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-navy-500 dark:text-navy-400 min-w-0">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
        </svg>
        <span className="truncate">Host: {v.host?.full_name ?? v.department?.name ?? '—'}</span>
      </p>

      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-navy-500 dark:text-navy-400 min-w-0">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
        <span className="truncate">{v.purpose ?? '—'}</span>
      </p>

      {/* WHICH DESK this visitor came through (client instruction, 2026-08-16:
          "always everybody should be able to see who is walk-in and who is
          pre-approved"). The All Visitors list mixes the two in one grid, and
          once a visit reaches `checked_in` both routes have converged — the
          status badge below says "On-site" for a pre-booked visitor and for a
          walk-in alike, so from that point on nothing on this card said how the
          person got in.

          It renders ONLY while the badge does not already carry the answer:
          `STATUS_STYLES.approved` reads "Pre-approved" in so many words, so on
          an unconverged row this chip would be the same fact twice on one card.
          `statusProvesOrigin` is the test, in lib/visitOrigin.ts beside the
          inference itself.

          It is an OUTLINE chip, deliberately unlike the filled status pill, so
          the two never read as two statuses — this says what kind of visit it
          is, that one says where the visit has got to. */}
      {!statusProvesOrigin(v.status) && (
        <p className="mt-3">
          <span className="inline-flex items-center rounded-md border border-surface-200/80 dark:border-white/[0.12] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy-700">
            {visitOriginLabel(visitOrigin(v))}
          </span>
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs tabular-nums text-navy-700 dark:text-navy-200 min-w-0">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {/* Never a bare time: these lists are not date-bounded. */}
          <span className="truncate">{stamp.label} {formatDateTime(stamp.iso)}</span>
        </span>
        {/* The status badge is the ONLY carrier of status on this card, which
            is why it is text and not just a tint — see the no-colour-rail note
            above. Colours come from lib/statusStyles.ts so every screen spells
            a status the same way. */}
        <span className={`shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-1 ${status.bg} ${status.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
          {status.label}
        </span>
      </div>
    </div>
  );
}
