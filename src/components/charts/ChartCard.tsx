import React from 'react';

// The frame every chart on the admin surface sits in: the glass card, the
// heading, an optional explanation, and one optional control on the trailing
// edge.
//
// It is deliberately NOT DashboardPanel. That component leads with a brand
// glyph and prints a COUNT beside its heading — the length of the list inside
// it, which is the rule that keeps a tile's number and its rows in step. A
// chart has no list and no count, so reusing it would mean either an empty
// slot where every other panel shows a number, or a number derived some second
// way. Same glass, same radius, same heading step; different contract.
//
// The reference screens put a small ⓘ next to each chart title. It is a
// TOOLTIP ON THE TITLE (`title` attribute plus an accessible description), not
// a popover: the thing it explains is one sentence long, and a click-to-open
// panel for one sentence is a control the reader has to discover before they
// can read the chart they are already looking at.

type Props = {
  heading: string;
  /** One sentence saying what the chart counts. Surfaced as the ⓘ tooltip. */
  about?: string;
  /** A single control on the trailing edge — a range picker, usually. */
  action?: React.ReactNode;
  /** Rendered under the heading row, above the chart. */
  children: React.ReactNode;
};

export default function ChartCard({ heading, about, action, children }: Props): React.ReactElement {
  const describedBy = about ? `chart-about-${heading.replace(/\W+/g, '-').toLowerCase()}` : undefined;
  return (
    <section
      aria-label={heading}
      aria-describedby={describedBy}
      className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm"
    >
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-h2 text-navy-950 dark:text-white">{heading}</h2>
        {about && (
          <>
            <span
              title={about}
              aria-hidden="true"
              className="shrink-0 w-4 h-4 rounded-full border border-navy-300 text-navy-500 text-[10px] leading-[14px] text-center cursor-help select-none"
            >
              i
            </span>
            <span id={describedBy} className="sr-only">{about}</span>
          </>
        )}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </section>
  );
}
