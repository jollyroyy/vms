import React from 'react';
import SettingToggle from '../../components/SettingToggle';
import type { SettingField as FieldSpec } from '../../lib/settingsSections';
import type { SettingValue } from '../../lib/appSettings';

type Props = {
  field: FieldSpec;
  value: SettingValue;
  onChange: (next: SettingValue) => void;
};

// One row of the Settings screen: the label, its explanation, the control, and
// — where the app does not yet obey the setting — a plain statement saying so.
//
// THAT LAST PART IS THE POINT OF THIS COMPONENT. A settings screen where some
// switches govern behaviour and others merely store a preference, with nothing
// on screen distinguishing them, is a screen that lies about what it controls.
// This project has already deleted a hardcoded "Gate Status: Operational" chip
// and an unconditional "Identity verified" line for exactly that reason, and a
// switch an admin believes they have turned on is a worse version of the same
// error — they will act as though the rule is in force.
//
// An unenforced field is still SAVED, and still editable. Greying it out would
// say "this is coming"; it is not the app's place to refuse to record an
// administrator's intent, only to be honest about what happens next.

export default function SettingsField({ field, value, onChange }: Props): React.ReactElement {
  const id = `setting-${field.key.replace(/\./g, '-')}`;

  const control = ((): React.ReactElement => {
    switch (field.control) {
      case 'toggle':
        return (
          <SettingToggle
            checked={value === true}
            onChange={(next) => onChange(next)}
            label={field.label}
          />
        );
      case 'number':
        return (
          <input
            id={id}
            type="number"
            className="input w-full sm:w-28 text-right tabular-nums"
            value={typeof value === 'number' ? value : ''}
            min={field.min}
            max={field.max}
            // Parsed here, not at save time. An `<input type="number">` yields a
            // string, and letting one reach the store would put `"12"` where the
            // schema says number — which `coerceSetting` would rescue on read,
            // but only by silently repairing a row we wrote wrong.
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next)) onChange(next);
            }}
          />
        );
      case 'select':
        return (
          <select
            id={id}
            className="input w-full sm:w-56"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
          >
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      case 'time':
        return (
          <input
            id={id}
            type="time"
            className="input w-full sm:w-32"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      default:
        return (
          <input
            id={id}
            type="text"
            className="input w-full sm:w-64"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  })();

  return (
    <div className="flex flex-wrap items-start gap-4 py-3 border-b border-surface-200/50 dark:border-white/[0.06] last:border-0">
      <div className="min-w-0 flex-1">
        <label htmlFor={field.control === 'toggle' ? undefined : id}
               className="block text-sm text-navy-800">
          {field.label}
        </label>
        {field.hint && <p className="text-xs text-navy-500 mt-0.5">{field.hint}</p>}
        {!field.enforced && (
          <p className="text-xs text-warning-700 mt-1">
            Recorded — not yet enforced.{field.caveat ? ` ${field.caveat}` : ''}
          </p>
        )}
        {field.enforced && field.caveat && (
          <p className="text-xs text-navy-500 mt-1">{field.caveat}</p>
        )}
      </div>
      {/* `w-full` on a phone forces this control onto its own line: the label
          beside it is `min-w-0 flex-1`, which can shrink all the way to
          nothing without ever triggering `flex-wrap` on the row above, so a
          fixed-width control (256px for the text case) was squeezing the
          label down to an unreadable sliver rather than the two stacking. */}
      <div className="w-full sm:w-auto sm:shrink-0 pt-0.5">{control}</div>
    </div>
  );
}
