import React from 'react';
import { formatDateTime } from '../lib/formatDate';
import { maskIdProof } from '../lib/pii';
import type { ReportVisit } from '../lib/reportRow';

// The ID tab of the visitor popup (client instruction, 2026-08-15).
//
// "What ID did we take off this person, and does the face match?" used to be a
// single masked line — "Aadhaar ••••42" — buried between Purpose and Carrying,
// which is the one question a guard is later asked to account for. It gets its
// own tab: the photo captured at the gate at a size a face can actually be
// checked against, the KIND of document beside it, and the card that was handed
// over.
//
// What is NOT here, and must not be invented: there is no ID document image in
// the schema. `visitors` stores `id_type` and `id_last4` and nothing else — by
// design (NFR-05 / the Aadhaar Act: a full number is never stored, so it can
// never be displayed). A framed placeholder saying "document unavailable" would
// imply a scan exists somewhere; it does not. Add the column first.

/** Only true when BOTH halves are on record. It is a claim about a person on a
 *  screen someone may later have to justify, so it is never hardcoded — the
 *  same rule the check-in frame's "Identity verified" chip follows. */
export function isIdentityVerified(v: ReportVisit): boolean {
  return Boolean(v.photo_url && v.visitor?.id_type);
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-surface-200/60 dark:border-white/[0.07] bg-surface-50 dark:bg-white/[0.03] px-3.5 py-2.5">
      <p className="text-micro text-navy-500 uppercase leading-none mb-1">{label}</p>
      <p className={`text-body font-semibold text-navy-800 break-words ${mono ? 'tabular-nums tracking-wide' : ''}`}>{value}</p>
    </div>
  );
}

export default function VisitorDetailsIdCard({ visit: v }: { visit: ReportVisit }): React.ReactElement {
  const verified = isIdentityVerified(v);
  // The type on its own, unmasked — it is not the number, and it is the half
  // the guard is actually comparing against the document in their hand.
  const idType = v.visitor?.id_type ?? null;

  return (
    <div className="px-5 pt-4 pb-3 space-y-3.5 animate-fade-in">
      {/* Tinted in LIGHT MODE ONLY (client report, 2026-08-16), for the reason
          the popup's header band is: the captured face and the verdict beside
          it are the whole point of this tab, and on a white modal they had no
          edge separating them from the fields below. Dark mode keeps the flat
          panel it already had — a lighter patch there is the exact complaint
          the 2026-08-15 rebuild removed. */}
      <div className="flex items-start gap-4 rounded-2xl bg-surface-100/70 dark:bg-transparent border border-surface-200/60 dark:border-transparent p-3.5 dark:p-0">
        {/* The face, at a size a face can be checked at. The 56px thumbnail on
            the profile card above identifies the row; this one is the record. */}
        {v.photo_url ? (
          <figure className="shrink-0">
            <img
              src={v.photo_url}
              alt={`Photo captured at check-in for ${v.visitor?.full_name ?? 'this visitor'}`}
              className="w-28 h-28 object-cover rounded-2xl ring-2 ring-brand-500/25 shadow-elevated"
            />
            {v.checked_in_at && (
              <figcaption className="text-micro text-navy-500 mt-1.5 text-center">
                {formatDateTime(v.checked_in_at)}
              </figcaption>
            )}
          </figure>
        ) : (
          <div className="w-28 h-28 shrink-0 rounded-2xl border border-dashed border-surface-300 dark:border-white/[0.12] bg-surface-50 dark:bg-white/[0.02] flex flex-col items-center justify-center gap-1.5 text-center px-2">
            <svg className="w-6 h-6 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            <span className="text-micro text-navy-500 leading-tight">No photo captured yet</span>
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          {/* Rendered only when it is TRUE. A reassuring green chip that shows
              for everyone says nothing and misleads someone reading the record
              back later. */}
          {verified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 text-success-700 px-2.5 py-1 text-caption font-bold">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Identity verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 dark:bg-white/[0.05] text-navy-600 px-2.5 py-1 text-caption font-bold">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {v.photo_url ? 'No ID recorded' : 'Not verified at the gate'}
            </span>
          )}
          <Field label="ID Proof Type" value={idType ?? 'None recorded'} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="ID Number" value={maskIdProof(idType, v.visitor?.id_last4)} mono />
        <Field
          label="Visitor Card"
          value={v.visitor_card_number ?? 'None issued'}
          mono={Boolean(v.visitor_card_number)}
        />
      </div>

      {/* Only ever rendered from a real timestamp — the CHECK behind migration
          076 will not let a card be marked returned without one. */}
      {v.visitor_card_returned_at && (
        <p className="flex items-center gap-1.5 text-caption text-navy-600">
          <svg className="w-3.5 h-3.5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Card returned {formatDateTime(v.visitor_card_returned_at)}
        </p>
      )}

      <p className="text-micro text-navy-500 leading-relaxed">
        Only the document type and its last digits are ever stored — a full ID number is
        never written to this system.
      </p>
    </div>
  );
}
