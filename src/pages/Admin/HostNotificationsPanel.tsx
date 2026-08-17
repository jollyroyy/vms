import React from 'react';
import SettingToggle from '../../components/SettingToggle';
import type { SettingKey, SettingsMap } from '../../lib/appSettings';

// THE SWITCH IS `components/SettingToggle`, not a second one written here
// (client report, 2026-08-17: the Host Notifications switches were "not showing
// properly"). This panel had its own hand-rolled copy, and the copy had drifted
// in exactly the way a duplicate always does: its OFF track was
// `bg-surface-200`, which is the same value as the card it sits on
// (`bg-surface-100/60` over surface), so an off switch was an invisible
// rectangle with a white dot floating in it — the knob was the only thing
// drawn, and nothing said there was a control there to press. The shared
// component uses `bg-surface-300`, which is a step darker than any card it can
// land on, and it also carries the focus ring and the `aria-hidden` knob the
// copy had lost. One switch, one look, one accessible contract.

type ToggleSpec = {
  key: SettingKey;
  label: string;
  hint: string;
  /**
   * Does the running app actually obey this key today? A screen where some
   * switches govern behaviour and others merely store a preference, with
   * nothing distinguishing them, lies about what it controls.
   */
  enforced: boolean;
  /** Shown when `enforced` is false. */
  caveat?: string;
};

// The three host-notification switches, and whether each is real.
//
// The enforcement flags USED TO BE READ OUT OF `settingsSections.ts`, so this
// panel and the full Settings screen could not disagree. That screen no longer
// declares these fields — it was cut to Departments and Users on 2026-08-17 —
// which makes this panel the ONLY place they are configured, and therefore the
// place that owns the truth about them. There is no second copy to drift from.
const TOGGLES: ToggleSpec[] = [
  { key: 'notify.host_email_on_arrival', label: 'Email on arrival',
    hint: 'Send an email notification when a visitor arrives for the host.',
    enforced: true },
  { key: 'notify.host_sms_on_arrival', label: 'SMS on arrival',
    hint: 'Send an SMS notification when a visitor arrives for the host.',
    enforced: false,
    caveat: 'No SMS provider is configured. The in-app notification is written either way.' },
  { key: 'notify.host_signout_reminder', label: 'Auto sign-out reminder',
    hint: 'Remind hosts to sign their visitors out.',
    enforced: false,
    caveat: 'The nightly sweep closes stale visits; a per-host reminder job does not exist yet.' },
];

type Props = {
  settings: SettingsMap | null;
  /** The key currently being written, so its switch can show a busy state
   *  rather than let a second click race the first. */
  saving: SettingKey | null;
  onToggle: (key: SettingKey, next: boolean) => void;
};

export default function HostNotificationsPanel({ settings, saving, onToggle }: Props): React.ReactElement {
  return (
    <ul className="divide-y divide-surface-200/60 dark:divide-white/[0.07]">
      {TOGGLES.map((t) => {
        const checked = settings ? Boolean(settings[t.key]) : false;
        const { enforced, caveat } = t;
        const busy = saving === t.key;
        return (
          <li key={t.key} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-navy-950 dark:text-white">{t.label}</p>
              <p className="text-xs text-navy-700 mt-0.5">{t.hint}</p>
              {/* `navy-700`, not `navy-500`. This line is the one that tells an
                  admin the switch above it does nothing yet — the single most
                  consequential sentence on the panel — and at 12px italic on a
                  tinted card navy-500 was the faintest text on screen. */}
              {!enforced && caveat && (
                <p className="text-xs text-navy-700 mt-1 italic">Recorded — not yet enforced. {caveat}</p>
              )}
            </div>
            <span className="shrink-0 mt-0.5">
              <SettingToggle
                checked={checked}
                onChange={(next) => onToggle(t.key, next)}
                label={t.label}
                disabled={!settings || busy}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
