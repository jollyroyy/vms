import React from 'react';

import type { ReportVisit } from '../lib/reportRow';
import { gateChips, CHIP_CLASS } from '../lib/visitGateChips';

// The row of small boxed labels: presence, overstay, late arrival.
//
// Shared by the Entry & Exit table and the guard dashboard's panel so one
// visitor reads identically on both — see lib/visitGateChips.ts for the rules
// and why they live in one place.

export default function GateChips({
  visit,
  now = new Date(),
  className = '',
}: {
  visit: ReportVisit;
  now?: Date;
  className?: string;
}): React.ReactElement {
  const chips = gateChips(visit, now);
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {chips.map((c) => (
        <span
          key={c.key}
          className={`inline-block text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-1 border whitespace-nowrap ${CHIP_CLASS[c.tone]}`}>
          {c.label}
        </span>
      ))}
    </span>
  );
}
