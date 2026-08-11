import React from 'react';

// The timeline spine entry shared by VisitorDetails' audit strip. Extracted
// (2026-08-11) to keep VisitorDetails.tsx under the 300-line limit; nothing
// else uses it.
type Props = {
  color: string;
  label: string;
  time: string;
  highlight?: boolean;
  strong?: boolean;
};

export default function TimelineEntry({ color, label, time, highlight, strong }: Props): React.ReactElement {
  return (
    <div className="flex items-start gap-3 relative">
      {/* The ring separates the dot from the timeline spine behind it, so it
          has to match the panel, not be white — `navy-50` is the darkest end
          of the flipped scale and reads as the panel in dark mode. */}
      <div className={`w-[11px] h-[11px] rounded-full ${color} border-2 border-white dark:border-navy-50 shrink-0 mt-0.5 z-10`} />
      <div className={`flex-1 flex justify-between items-baseline gap-2 min-w-0 ${highlight ? 'text-danger-600 font-bold' : ''}`}>
        <span className="text-micro uppercase text-navy-500 shrink-0">{label}</span>
        <span className={`truncate tabular-nums ${strong ? 'text-body-lg font-bold' : 'text-body font-semibold'} ${highlight ? 'text-danger-600' : 'text-navy-800'}`}>{time}</span>
      </div>
    </div>
  );
}