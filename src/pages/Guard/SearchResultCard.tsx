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

const PURPOSE_LABELS: Record<string, string> = {
  meeting: 'Meeting', vendor: 'Vendor', interview: 'Interview',
  delivery: 'Delivery', maintenance: 'Maintenance', audit: 'Audit', other: 'Other',
};

function Field({ label, value }: { label: string; value: string | null | undefined }): React.ReactElement | null {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold text-navy-300 dark:text-navy-500 uppercase tracking-wider leading-none mb-1">{label}</p>
      <p className="text-[12.5px] font-semibold text-navy-800 dark:text-navy-100 truncate leading-tight">{value}</p>
    </div>
  );
}

export default function SearchResultCard({ visit: v, onClick }: { visit: Visit; onClick: () => void }): React.ReactElement {
  const style = STATUS_STYLES[v.status];

  return (
    <div
      className="bg-white dark:bg-white/[0.045] rounded-2xl border border-surface-200/80 dark:border-white/[0.07] p-4 cursor-pointer card-hover animate-fade-in shadow-sm hover:shadow-md transition-shadow"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      {/* Identity row */}
      <div className="flex gap-3 items-center">
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
          <p className="font-display font-bold text-navy-950 dark:text-white truncate text-[15px] leading-tight">{v.visitor?.full_name ?? '—'}</p>
          {v.visitor?.vendor_name && <p className="text-[12px] text-navy-400 dark:text-navy-400 truncate mt-0.5">{v.visitor.vendor_name}</p>}
        </div>
        <span className={`shrink-0 status-badge ${style.bg} ${style.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot} ${v.status === 'checked_in' ? 'animate-pulse-soft' : ''}`} />
          {style.label}
        </span>
      </div>

      {/* Field grid — everything the user asked a search result to surface:
          who, vendor (above), department, who they're meeting, why, phone,
          the reference number, and when the visit is/was. */}
      <div className="mt-3.5 pt-3.5 border-t border-surface-200/60 dark:border-white/[0.06] grid grid-cols-2 gap-x-3 gap-y-2.5">
        <Field label="Department" value={v.department?.name} />
        <Field label="Person to Meet" value={v.host?.full_name} />
        <Field label="Purpose" value={PURPOSE_LABELS[v.purpose] ?? v.purpose} />
        <Field label="Phone" value={v.visitor?.phone} />
        <Field label="Ref" value={v.ref_number} />
        <Field label="Date & Time" value={formatDateTime(v.scheduled_for ?? v.created_at)} />
      </div>
    </div>
  );
}
