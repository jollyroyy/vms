import React from 'react';
import type { SettingKey, SettingsMap } from '../../lib/appSettings';
import { SETTINGS_SECTIONS } from '../../lib/settingsSections';

type ToggleSpec = { key: SettingKey; label: string; hint: string };

// The three host-notification switches, curated for this tab rather than the
// full Settings screen's generic field list — a guard reading "Hosts" should
// not have to know the settings vocabulary to know what these do.
const TOGGLES: ToggleSpec[] = [
  { key: 'notify.host_email_on_arrival', label: 'Email on arrival',
    hint: 'Send an email notification when a visitor arrives for the host.' },
  { key: 'notify.host_sms_on_arrival', label: 'SMS on arrival',
    hint: 'Send an SMS notification when a visitor arrives for the host.' },
  { key: 'notify.host_signout_reminder', label: 'Auto sign-out reminder',
    hint: 'Remind hosts to sign their visitors out.' },
];

/** Whether the running app actually obeys this key today, and what caveat to
 *  show if not — read from `settingsSections.ts` rather than restated here,
 *  so this panel and the full Settings screen can never disagree about which
 *  switches are real. */
function enforcement(key: SettingKey): { enforced: boolean; caveat?: string } {
  for (const section of SETTINGS_SECTIONS) {
    for (const group of section.groups) {
      const field = group.fields.find((f) => f.key === key);
      if (field) return { enforced: field.enforced, caveat: field.caveat };
    }
  }
  // A key with no entry in settingsSections.ts is a bug in this file, not a
  // reason to claim a caveat that was never written.
  return { enforced: true };
}

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
        const { enforced, caveat } = enforcement(t.key);
        const busy = saving === t.key;
        return (
          <li key={t.key} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-navy-950 dark:text-white">{t.label}</p>
              <p className="text-xs text-navy-700 mt-0.5">{t.hint}</p>
              {!enforced && caveat && (
                <p className="text-xs text-navy-500 mt-1 italic">Recorded — not yet enforced. {caveat}</p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={checked}
              aria-label={t.label}
              disabled={!settings || busy}
              onClick={() => onToggle(t.key, !checked)}
              className={`shrink-0 mt-0.5 w-10 h-6 rounded-full transition-colors relative disabled:opacity-50
                         ${checked ? 'bg-brand-500' : 'bg-surface-200 dark:bg-white/10'}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                           ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
