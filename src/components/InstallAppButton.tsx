import React from 'react';
import { useInstallPrompt } from '../lib/useInstallPrompt';

/**
 * The one "Install app" control, on the two screens that can be reached without
 * one: the login card (a phone being set up for the first time) and the sidebar
 * (a guard who signed in months ago and never sees the login page again).
 *
 * IT RENDERS NOTHING UNLESS THE BROWSER HAS OFFERED AN INSTALL — see
 * lib/useInstallPrompt.ts for why that is the only honest condition. This
 * component owns no part of that decision; it owns the words and the press.
 *
 * THE CALLER OWNS THE LOOK. The sidebar needs a `sidebar-link` row that
 * collapses to an icon, the login card needs a quiet line on a photograph, and
 * neither is a variant of the other. What must NOT drift is the label, which is
 * why there is a component here at all rather than two copies of a button.
 */
export default function InstallAppButton({
  className = '',
  showLabel = true,
}: {
  className?: string;
  /** False renders the icon alone — the collapsed sidebar. The accessible name
   *  is on the button either way, so the control is never unlabelled. */
  showLabel?: boolean;
}): React.ReactElement | null {
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={() => { void install(); }}
      aria-label="Install app"
      className={className}
    >
      <span className="shrink-0">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v13.5m0 0 4.5-4.5M12 16.5 7.5 12M3.75 17.25v1.5A2.25 2.25 0 0 0 6 21h12a2.25 2.25 0 0 0 2.25-2.25v-1.5" />
        </svg>
      </span>
      {showLabel && <span>Install app</span>}
    </button>
  );
}
