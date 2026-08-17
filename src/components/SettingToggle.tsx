import React from 'react';

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name. The visible label sits beside the switch, so this is
   *  passed as `aria-label` rather than rendered again — the same value drawn
   *  twice is what the no-duplicate-renders rule exists to prevent. */
  label: string;
  disabled?: boolean;
};

// The one switch on the admin Settings screen.
//
// A real `<button role="switch">` with `aria-checked`, not a styled checkbox
// and not a div. The distinction matters here more than usual: this screen is
// almost entirely switches, so a control that a screen reader announces as
// "clickable" rather than "switch, on" would make the whole page unreadable
// non-visually, and a keyboard user needs Space and Enter to work without the
// page adding its own handler.
//
// The knob's position carries the state, and so does `aria-checked` — but
// colour does not carry it alone: the track's shape changes with the knob, so
// the state survives a viewer who cannot separate the brand blue from the
// neutral grey.

export default function SettingToggle({ checked, onChange, label, disabled = false }: Props): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2
                  focus-visible:ring-offset-surface-50 disabled:opacity-40 disabled:cursor-not-allowed
                  ${checked ? 'bg-brand-500' : 'bg-surface-300 dark:bg-white/[0.15]'}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200
                    ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}
