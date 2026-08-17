import React from 'react';
import DashboardPanel from '../../components/DashboardPanel';
import { ICON_SHIELD_X } from '../../lib/tileIcons';

// There is NO watchlist table in this schema — the guard-facing Watchlist tab
// was deleted 2026-08-15 for exactly this reason (CLAUDE.md: "the only
// columns backing it were `visitors.is_blacklisted` + `blacklist_reason`",
// the same two columns the Blacklist panel above already renders). This panel
// stays only to say that honestly, on the reference screen's own name for it,
// rather than pretending a second, richer list exists somewhere. It never
// renders a row — there is nothing to build one out of.
export default function AdminWatchlistPanel(): React.ReactElement {
  return (
    <DashboardPanel icon={ICON_SHIELD_X} heading="Watchlist" loading={false}>
      <p className="text-sm text-navy-500 py-6 text-center">
        Watchlist entries are not recorded separately from the blacklist above —
        there is no additional watchlist to show.
      </p>
    </DashboardPanel>
  );
}
