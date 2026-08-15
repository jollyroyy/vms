import React from 'react';

/**
 * The three stages of a check-in, named on screen.
 *
 * A guard who presses "Verify ID" gets the ID scan, and then — the moment the
 * scan closes — a second camera opens for the visitor's face. Both are cameras,
 * and on a laptop with one webcam they are literally the same device, so the
 * photo step read as the ID scan starting over. Nothing on screen said the
 * flow had moved on. This says it.
 *
 * The ID scan is marked OPTIONAL, not pending, because it genuinely is: Check
 * In is blocked by a missing card number and by a name mismatch, never by the
 * absence of a scan. A tracker that implied otherwise would be claiming a rule
 * the code does not enforce.
 */
export type StepState = 'done' | 'current' | 'todo' | 'optional';

type Step = { label: string; state: StepState };

type Props = {
  /** An ID scan has been accepted for this visitor. */
  scanned: boolean;
  /** A photo has been captured. */
  photoTaken: boolean;
  /** A well-formed visitor card number has been entered. */
  cardDone: boolean;
};

const DOT: Record<StepState, string> = {
  done: 'bg-success-500 text-white border-success-500',
  current: 'bg-brand-600 text-white border-brand-600',
  todo: 'bg-transparent text-navy-700 border-surface-300',
  optional: 'bg-transparent text-navy-700 border-surface-300 border-dashed',
};

// Single navy steps, never a `dark:text-navy-*` pair — the navy scale is
// inverted in dark mode, so an override picks the wrong end (see CLAUDE.md).
const LABEL: Record<StepState, string> = {
  done: 'text-navy-800',
  current: 'text-navy-950 font-bold',
  todo: 'text-navy-700',
  optional: 'text-navy-700',
};

export default function CheckInStepTracker({ scanned, photoTaken, cardDone }: Props): React.ReactElement {
  const steps: Step[] = [
    { label: 'Scan ID', state: scanned ? 'done' : 'optional' },
    { label: 'Photo', state: photoTaken ? 'done' : 'current' },
    { label: 'Card', state: cardDone ? 'done' : photoTaken ? 'current' : 'todo' },
  ];

  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Check-in steps">
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center gap-2 min-w-0">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${DOT[step.state]}`}
            aria-hidden="true">
            {step.state === 'done' ? '✓' : i + 1}
          </span>
          <span
            className={`truncate ${LABEL[step.state]}`}
            aria-current={step.state === 'current' ? 'step' : undefined}>
            {step.label}
            {step.state === 'optional' && <span className="text-navy-700 font-normal"> (optional)</span>}
          </span>
          {i < steps.length - 1 && <span aria-hidden="true" className="h-px w-4 shrink-0 bg-surface-300" />}
        </li>
      ))}
    </ol>
  );
}
