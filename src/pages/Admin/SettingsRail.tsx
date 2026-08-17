import React from 'react';
import { SETTINGS_SECTIONS, type SettingsSectionKey } from '../../lib/settingsSections';

type Props = {
  active: SettingsSectionKey;
  onSelect: (key: SettingsSectionKey) => void;
};

// The Settings screen's left-hand section list.
//
// It is a SECOND navigation on a page that already has the app sidebar beside
// it, which this project normally refuses — the HOD console's horizontal tab
// bar was deleted in 2026-08-15 for exactly that reason, because two nav bars
// on one screen leave the reader working out which is authoritative. The
// difference here is scope: the sidebar moves between PAGES, this moves between
// parts of one form, and the Save Changes button at the top applies across all
// of them. Collapsing these six into six sidebar items would put configuration
// sections at the same level as the visitor tabs and make the sidebar twice as
// long for a screen an admin opens rarely.
//
// Each section is a real `?section=` value so a deep link into Roles & Users
// works — the Hosts tab links straight to it.

export default function SettingsRail({ active, onSelect }: Props): React.ReactElement {
  return (
    <nav aria-label="Settings sections"
         className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-2 shadow-glow-sm">
      <ul>
        {SETTINGS_SECTIONS.map((section) => {
          const isActive = section.key === active;
          return (
            <li key={section.key}>
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect(section.key)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive
                    // A left bar plus a tinted fill, not colour alone — the
                    // active row must still read as active without hue.
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold border-l-2 border-brand-500'
                    : 'text-navy-700 hover:bg-surface-200/50 dark:hover:bg-white/[0.05] border-l-2 border-transparent'
                }`}
              >
                {section.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
