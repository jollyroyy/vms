import React from 'react';

export type KpiTone = 'brand' | 'success' | 'warning' | 'danger' | 'violet';

// Filled plate, label above the numeral, caption under it. The tone drives the
// plate only.
const TONE: Record<KpiTone, string> = {
  brand: 'bg-brand-500 text-white',
  success: 'bg-success-500 text-white',
  warning: 'bg-warning-500 text-white',
  danger: 'bg-danger-500 text-white',
  violet: 'bg-[#a855f7] text-white',
};

const CAPTION_TONE: Record<KpiTone, string> = {
  brand: 'text-navy-500',
  success: 'text-success-700',
  warning: 'text-warning-700',
  danger: 'text-danger-700',
  violet: 'text-navy-500',
};

type Props = {
  label: string;
  /** Already formatted — "86", "38s", "42 / 44", "4.6". The tile does not
   *  format, because two of the six are not counts and a numeric prop would
   *  force every caller through a stringifier anyway. */
  value: string;
  icon: string;
  tone?: KpiTone;
  /** The line under the numeral. Says what the figure is OF, or how it moved. */
  caption?: string;
  /** Colours the caption with the tone — for a caption that is itself a
   *  warning ("Requires attention"), never for a neutral qualifier. */
  captionToned?: boolean;
  loading?: boolean;
};

// THE admin surface's KPI card, drawn once and used by all six boards
// (Dashboard, Pre-Registration, Hosts, Badge Printing, Security, Reports).
//
// It is a DIV, not a button, and it opens nothing. That is the whole difference
// from `KpiTile`/`DashboardTile`, whose contract is "a tile's count is the
// length of the list it opens" — those drill down, and their number and their
// rows come from one predicate for that reason. These sit above a list that is
// ALREADY the thing they count, on a surface where the admin cannot act on a
// row anyway, so a chevron would promise an interaction that does not exist.
// A card that looks pressable and is not is worse than a plain one.
//
// The plate is FILLED here rather than ringed, matching the reference screens
// the client froze for the admin console. Colour is never the only carrier:
// every tile prints its label and its caption in words.

export default function AdminKpiTile({
  label, value, icon, tone = 'brand', caption, captionToned = false, loading = false,
}: Props): React.ReactElement {
  return (
    <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07]
                    px-5 py-4 flex items-center gap-4 shadow-glow-sm">
      <span className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${TONE[tone]}`}>
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-navy-500 dark:text-navy-600 truncate">{label}</span>
        <span className="block font-display text-[2rem] leading-tight font-medium tracking-tight tabular-nums text-navy-950 dark:text-white">
          {loading ? '—' : value}
        </span>
        {caption && (
          <span className={`block text-xs mt-0.5 ${captionToned ? CAPTION_TONE[tone] : 'text-navy-500'}`}>
            {caption}
          </span>
        )}
      </span>
    </div>
  );
}
