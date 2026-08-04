import React from 'react';
import type { Visit } from '../../types/index';
import { STATUS_STYLES } from '../../lib/statusStyles';
import { railFor } from '../../lib/statusRail';
import { formatTime } from '../../lib/formatDate';

type Props = {
  visit: Visit;
  /** Primary action, e.g. Check In / Check Out. Rendered as a 44px target. */
  action?: { label: string; onClick: () => void };
  /** Opens the detail sheet. The whole card is clickable when supplied. */
  onSelect?: (visit: Visit) => void;
  /** Leading time column — the booked arrival, or the check-in instant. */
  timeLabel?: string;
};

// The one visitor card used across the guard console. Glass surface, status
// rail on the leading edge, and a strict text hierarchy: exactly ONE loud line
// (the visitor's name), because a guard scanning a column of these is looking
// for a person, not a purpose code.
//
// Ordering left-to-right follows how the information is actually used:
//   time → photo → who they are → who they're here for → status → action
export default function VisitorCard({ visit: v, action, onSelect, timeLabel }: Props): React.ReactElement {
  const style = STATUS_STYLES[v.status];
  const clickable = Boolean(onSelect);

  const inner = (
    <>
      {timeLabel && (
        <div className="shrink-0 w-14 text-center">
          <span className="visitor-card-fact">{timeLabel}</span>
        </div>
      )}

      {v.photo_url ? (
        <img src={v.photo_url} alt="" className="visitor-photo" />
      ) : (
        <div className="visitor-photo-empty" aria-hidden="true">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
          </svg>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="visitor-card-name">{v.visitor?.full_name ?? 'Unknown visitor'}</p>
        <p className="visitor-card-meta">
          {v.visitor?.vendor_name ? `${v.visitor.vendor_name}` : ''}
          {v.purpose ? `${v.visitor?.vendor_name ? ' · ' : ''}${v.purpose}` : ''}
        </p>
      </div>

      {/* Person to Meet — the second-most-asked question at a gate ("who are
          you here to see?"), so it gets its own column rather than being
          folded into meta. Department moved here too, under their name —
          it used to also sit in the meta line above, which rendered the
          same value twice on one card. */}
      <div className="hidden md:block text-right shrink-0 min-w-0 max-w-[9rem]">
        <p className="text-[11px] text-navy-300 uppercase tracking-wide">Person to Meet</p>
        <p className="text-[13px] font-semibold text-navy-700 truncate">{v.host?.full_name ?? '—'}</p>
        {v.host?.full_name && (
          <p className="text-[11px] text-navy-400 truncate">{v.department?.name ?? '—'}</p>
        )}
      </div>

      <span className={`status-badge shrink-0 ${style.bg} ${style.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
        {style.label}
      </span>

      {action && (
        <button type="button" className="gate-action"
          onClick={(e) => { e.stopPropagation(); action.onClick(); }}>
          {action.label}
        </button>
      )}
    </>
  );

  const cls = `visitor-card ${railFor(v.status)} ${clickable ? 'cursor-pointer' : ''}`;

  if (clickable) {
    return (
      <div className={cls} role="button" tabIndex={0}
        onClick={() => onSelect?.(v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(v); } }}>
        {inner}
      </div>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/** Convenience: the time a card should show for an expected visitor. */
export function expectedTimeLabel(v: Visit): string {
  return v.scheduled_for ? formatTime(v.scheduled_for) : 'Anytime';
}
