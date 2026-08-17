// One search result — the full-detail card the search page asked for, not a
// cramped one-line row. Visual idiom copied from OverviewFilteredView's local
// VisitorCard: photo/avatar, name + vendor, status badge, then a labelled
// field grid. Clicking anywhere opens <VisitorDetails>, which is where the
// approval time (resolved through approvalTimestamp()) and full timeline live
// — this card only has to get the visitor to that popup, not duplicate it.
import React from 'react';
import type { Visit } from '../../types/index';
import { formatDateTime } from '../../lib/formatDate';
import { STATUS_STYLES } from '../../lib/statusStyles';
import { visitOrigin, visitOriginLabel } from '../../lib/visitOrigin';
import CardField from '../../components/CardField';
import { CRISP_CARD_INTERACTIVE } from '../../lib/cardStyles';

const PURPOSE_LABELS: Record<string, string> = {
  meeting: 'Meeting', vendor: 'Vendor', interview: 'Interview',
  delivery: 'Delivery', maintenance: 'Maintenance', audit: 'Audit', other: 'Other',
};

// Header = visitor name (identity) + status pill (state) only. Vendor moved
// into the field grid below — it used to also print here under the name,
// duplicating the "Vendor" field a search result already carries (client
// feedback, 2026-08-10).
export default function SearchResultCard({ visit: v, onClick }: { visit: Visit; onClick: () => void }): React.ReactElement {
  const style = STATUS_STYLES[v.status];

  return (
    <div
      className={`${CRISP_CARD_INTERACTIVE} p-4 animate-fade-in`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      {/* Header — identity + state only */}
      <div data-card-header className="flex gap-3 items-center">
        <div className="shrink-0 relative">
          {v.photo_url ? (
            <img src={v.photo_url} alt="" className="w-12 h-12 object-cover rounded-full ring-2 ring-brand-500/15" />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-500/20 dark:to-accent-500/20 rounded-full flex items-center justify-center">
              <span className="text-base font-bold text-brand-500">{(v.visitor?.full_name ?? '?').charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-h3 text-navy-950 dark:text-white truncate">{v.visitor?.full_name ?? '—'}</p>
        </div>
        <span className={`shrink-0 status-badge ${style.bg} ${style.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot} ${v.status === 'checked_in' ? 'animate-pulse-soft' : ''}`} />
          {style.label}
        </span>
      </div>

      {/* Body — everything else a search result needs, exactly once each.
          Collapses to one column below `sm` (375px) so nothing crowds on a
          phone at the gate. */}
      <div className="mt-3.5 pt-3.5 border-t border-surface-200/60 dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5">
        <CardField label="Vendor" value={v.visitor?.vendor_name} />
        <CardField label="Department" value={v.department?.name} />
        <CardField label="Person to Meet" value={v.host?.full_name} />
        <CardField label="Purpose" value={PURPOSE_LABELS[v.purpose] ?? v.purpose} />
        <CardField label="Phone" value={v.visitor?.phone} />
        <CardField label="Ref" value={v.ref_number} className="font-mono" />
        {/* WHICH DESK they came through (client instruction, 2026-08-17). Same
            `lib/visitOrigin.ts` the popup and every list use, so this card and
            the record it opens cannot disagree. Unconditional, unlike
            VisitorGridCard's chip: the status pill above prints
            STATUS_STYLES.approved as "Pre-approved" only for that one status,
            and on the eight others there is nothing saying which desk this is.
            Read the INFERRED caveat in visitOrigin.ts before trusting it on a
            pre-2026-08 row. */}
        <CardField label="Type of Visitor" value={visitOriginLabel(visitOrigin(v))} />
        {/* Split apart. It was one "Date & Time" row falling back from
            `scheduled_for` to `created_at`, so the same label meant "the slot
            they were booked for" on a pre-approval and "when the request was
            raised" on a walk-in — two different facts under one heading, on the
            card whose whole job is telling one visitor from another. Each is
            now named, and each is absent rather than guessed at. */}
        {/* "NA", not a dash — the same wording `COLUMN.scheduled` uses on both
            dashboards (client instruction, 2026-08-16). A dash reads as a slot
            somebody forgot to record; the honest answer for a walk-in is that
            it never had one. Beside Type of Visitor the pair reads
            "Walk-in / NA". */}
        <CardField label="Scheduled" value={v.scheduled_for ? formatDateTime(v.scheduled_for) : null} empty="NA" />
        <CardField label="Registered" value={formatDateTime(v.created_at)} />
        {/* Conditional, not dashed. Before a visitor arrives their absence from
            the building is already stated by the status pill at the top of this
            card, and an "Checked In —" row under it would be that same fact a
            second time, in the weaker form. Once there is a time, it is a fact
            only this row carries. */}
        {v.checked_in_at && <CardField label="Checked In" value={formatDateTime(v.checked_in_at)} />}
        {v.checked_out_at && <CardField label="Checked Out" value={formatDateTime(v.checked_out_at)} />}
      </div>
    </div>
  );
}
