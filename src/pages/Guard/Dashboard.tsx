
import React from 'react';
import GuardDashboardMain from './GuardDashboardMain';

// The guard's home screen, rebuilt to match the approved reference design
// (Guard Console main overview). It renders the reference-exact layout from
// GuardDashboardMain — the four KPI tiles, the live arrival queue, the ID
// verification card and the watchlist banner — under the greeting strip.
export default function GuardDashboard(): React.ReactElement {
  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Clock + date now live in the global topbar (left of the
          notification bell) — see AppShell's TopbarClock (2026-08-14). */}
      <GuardDashboardMain />
    </div>
  );
}
