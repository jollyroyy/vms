import React from 'react';

type Props = {
  label: string;
  value: string | null | undefined;
  /** Rendered when `value` is empty. Never leave a fact blank on a card. */
  empty?: string;
  className?: string;
};

// The muted-label / strong-value pair used across every visitor card body —
// shadcn's convention: the label is quiet, the value carries the weight.
//
// Contrast floor (WCAG AA, 4.5:1 for normal text): `text-navy-400`, used for
// looser meta text elsewhere in the app, measures ~2.9:1 on a light card and
// fails outright. `navy-500` clears ~4.4:1 in light mode, which is why every
// field label built here uses it instead of the app's more common navy-400.
export default function CardField({ label, value, empty = '—', className }: Props): React.ReactElement {
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      <p className="text-micro uppercase text-navy-500 dark:text-navy-400 leading-none mb-1">{label}</p>
      <p className="text-body font-medium text-navy-800 dark:text-navy-100 truncate leading-tight">{value || empty}</p>
    </div>
  );
}
