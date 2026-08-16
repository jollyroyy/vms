// A `datetime-local` input with an explicit CONFIRM step.
//
// The native picker has no OK button on any desktop browser: you click a day,
// you tab into the time spinner, and the popup closes itself whenever it feels
// it has enough. An HOD booking a visitor could not tell whether the slot they
// had just clicked was the slot the form was holding — there was nothing on
// screen that said so, and nothing to press to say "yes, that one" (client
// report, 2026-08-16).
//
// So the confirmation is added here rather than left to the browser: a "Done"
// button that closes the picker, and a readable IST echo of the value the form
// will actually submit. The echo is the load-bearing half. `scheduled_for` is
// converted out of the browser's wall clock into IST before it is written
// (`istLocalToUtcIso`), so the only honest way to show an approver what they
// booked is to run the same conversion and print the result — a raw
// "2026-08-16T22:00" reads as a promise the database does not necessarily keep.
import React, { useRef, useState } from 'react';

import { istLocalToUtcIso } from '../lib/istDateTime';
import { formatDateTime } from '../lib/formatDate';

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Lower bound, as a bare `datetime-local` string. */
  min?: string;
  /** Helper copy under the field. */
  hint?: string;
};

export default function DateTimeField({
  id, label, value, onChange, required = false, min, hint,
}: Props): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  // Opening the picker is what puts the field into "being chosen" — that is
  // when a Done button is worth showing. It stays visible while a value is
  // present so the approver can reopen and re-confirm without guessing.
  const [touched, setTouched] = useState(false);

  // The exact instant that will be stored, printed the way every other screen
  // prints it. Null while the value is incomplete (the input hands back partial
  // strings mid-edit), which is why this is not rendered unconditionally.
  const utcIso = value ? istLocalToUtcIso(value) : null;

  const confirm = () => {
    setTouched(false);
    // Blur is what dismisses the native picker; there is no scripted close.
    inputRef.current?.blur();
  };

  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex items-stretch gap-2">
        <input
          ref={inputRef}
          id={id}
          type="datetime-local"
          required={required}
          value={value}
          min={min}
          onFocus={() => setTouched(true)}
          onChange={(e) => onChange(e.target.value)}
          className="input flex-1 min-w-0"
        />
        {(touched || value) && (
          <button
            type="button"
            onClick={confirm}
            disabled={!value}
            className="btn-secondary shrink-0 px-4 text-sm font-semibold disabled:opacity-50"
          >
            OK
          </button>
        )}
      </div>

      {/* The echo. `break-words`, never truncate — a clipped date is
          indistinguishable from a complete one, and this line exists precisely
          so the approver can check it. */}
      {utcIso && (
        <p className="mt-1.5 text-xs font-semibold text-brand-600 break-words">
          Selected: {formatDateTime(utcIso)}
        </p>
      )}

      {/* ONE step, no `dark:` override. The navy scale is INVERTED in dark
          mode, so a `text-navy-500 dark:text-navy-400` pair picks a darker
          colour in the dark theme — the override is the bug, not the fix. */}
      {hint && <p className="text-xs text-navy-700 mt-1">{hint}</p>}
    </div>
  );
}
