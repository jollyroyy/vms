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
  brand: 'text-navy-700',
  success: 'text-success-700',
  warning: 'text-warning-700',
  danger: 'text-danger-700',
  violet: 'text-navy-700',
};

// THE VALUE'S TYPE SIZE IS DERIVED FROM THE VALUE, never passed in.
//
// Two of the six dashboard figures are not counts: where nothing was measured
// and where nobody has rated, the tile prints a sentence ("Not measured", "No
// ratings") rather than a plausible-looking zero. At the display size a count
// is set in, that sentence is wider than the card and wrapped out of it
// entirely (client report, 2026-08-17). Prose gets a size prose is read at.
//
// Derived rather than declared because a caller who forgets is exactly how the
// overflow got in: `value` is already the formatted string, so the tile can see
// for itself which kind it has been handed.
function valueClass(value: string): string {
  if (value.length <= 4) return 'text-[2rem]';
  if (value.length <= 8) return 'text-[1.5rem]';
  return 'text-[1.15rem]';
}

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

// THE admin surface's KPI card, drawn once and used by every board that has
// tiles (Dashboard, Pre-Registration, Hosts, Security, Reports).
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
//
// THE THREE LINES ARE THREE DIFFERENT VOICES (client instruction, 2026-08-18:
// beautify the text in the KPI boxes). An 11px semibold uppercase EYEBROW names
// the measure, a display numeral set tight and heavy IS the answer, and an 11px
// caption with open leading qualifies it. They used to be 13px medium, 2rem
// medium and 12px — three sizes of roughly the same voice, which is why the
// cards read as busy: nothing on them was clearly subordinate to anything else.
// DashboardTile carries the identical treatment, so the guard, HOD and admin
// boards are one instrument.

// THE CARD IS STACKED, NOT A ROW (2026-08-17). The plate used to sit beside the
// text, which cost the figure 48px of plate plus 16px of gap out of a card that
// is one of six in a row — the text column came out around 125px and the label
// truncated to "Oversta…" while the value wrapped straight out of the border.
// Label and plate share the top line (the plate is decoration, the label is the
// only thing that has to be read there); the figure and its caption then get the
// card's whole width. `mt-auto` floats that block to the bottom, so the numerals
// line up across a row whose labels wrap to different numbers of lines.
//
// Nothing here truncates: a clipped label is indistinguishable from a short one,
// the same reason PassField uses break-words. Everything wraps instead, and the
// grid stretches the row to the tallest card.

export default function AdminKpiTile({
  label, value, icon, tone = 'brand', caption, captionToned = false, loading = false,
}: Props): React.ReactElement {
  const shown = loading ? '—' : value;
  return (
    <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07]
                    px-5 py-4 h-full flex flex-col gap-3 shadow-glow-sm">
      <span className="flex items-start justify-between gap-3">
        {/* One navy step, no `dark:` override. The scale is inverted per theme,
            so a single number already resolves to the correct end in both — the
            old `text-navy-500 dark:text-navy-600` was a hand-tuned second value
            for a job one value does. 700 is this file's secondary-text step and
            is a shade firmer than 500 was, which the label needed: it is the
            only thing on the top line that has to be read. */}
        <span className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.07em] leading-snug text-navy-700 break-words">{label}</span>
        <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${TONE[tone]}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </span>
      </span>

      <span className="block mt-auto min-w-0">
        <span className={`block font-display ${valueClass(shown)} leading-none font-semibold tracking-tight tabular-nums text-navy-950 break-words`}>
          {shown}
        </span>
        {caption && (
          <span className={`block text-[11px] mt-2 leading-relaxed break-words ${captionToned ? CAPTION_TONE[tone] : 'text-navy-700'}`}>
            {caption}
          </span>
        )}
      </span>
    </div>
  );
}
