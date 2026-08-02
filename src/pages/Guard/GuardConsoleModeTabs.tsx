import React from 'react';

// The guard console's tabs used to mirror DB status: checkin | exit |
// checked-out | no-show | rejected | all. Six tabs, of which three were audit
// views a guard never acts on. These three mirror guard INTENT instead — the
// only three questions asked at a gate:
//
//   Expected  — someone is booked, let them in
//   Walk-ins  — someone turned up unannounced, get them approved
//   Inside    — someone is leaving, let them out
//
// The audit views (checked-out / declined / all-today) were removed from the
// guard surface entirely, not demoted to a secondary row — they remain
// available in Reports for anyone who needs the audit trail.
export type Mode = 'expected' | 'walkins' | 'inside';

export const PRIMARY_MODES: Mode[] = ['expected', 'walkins', 'inside'];

type Props = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  expectedCount: number;
  walkInCount: number;
  insideCount: number;
};

const ICONS: Record<string, string> = {
  expected: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  walkins: 'M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z',
  inside: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9',
};

const LABELS: Record<string, string> = {
  expected: 'Expected',
  walkins: 'Walk-ins',
  inside: 'Inside',
};

export default function GuardConsoleModeTabs({
  mode, onModeChange, expectedCount, walkInCount, insideCount,
}: Props): React.ReactElement {
  const counts: Record<string, number> = {
    expected: expectedCount,
    walkins: walkInCount,
    inside: insideCount,
  };

  return (
    <div className="gate-tab-bar" role="tablist" aria-label="Visitor mode">
      {PRIMARY_MODES.map((m) => {
        const active = mode === m;
        return (
          <button key={m} type="button" role="tab" aria-selected={active}
            onClick={() => onModeChange(m)}
            className={`gate-tab ${active ? 'gate-tab-active' : ''}`}>
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[m]} />
            </svg>
            <span>{LABELS[m]}</span>
            <span className="gate-tab-count">{counts[m]}</span>
          </button>
        );
      })}
    </div>
  );
}
