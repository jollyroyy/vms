import React from 'react';
import AdminKpiTile from '../../components/AdminKpiTile';
import { ICON_SHIELD_X, ICON_X_CIRCLE } from '../../lib/tileIcons';

// The same warning triangle AdminDashboardKpis draws for Overstays — kept
// local rather than exported from tileIcons.ts, matching that file's own
// precedent of a one-off glyph living beside its single caller.
const ICON_WARN = 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z';

type Props = { blacklisted: number; alertsToday: number; deniedToday: number; loading: boolean };

// Three tiles, one per panel below them — no fourth "Watchlist" tile, because
// there is no watchlist table to count rows out of (see AdminWatchlistPanel).
//
// Every caption either names what the figure is of or says why it is toned:
// there is no comparison to state here (unlike the Dashboard's "vs
// yesterday"), so a plain descriptive caption is the honest one rather than
// inventing a trend line this tab has no data to support.
export default function AdminSecurityKpis({
  blacklisted, alertsToday, deniedToday, loading,
}: Props): React.ReactElement {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <AdminKpiTile
        label="Blacklisted"
        value={String(blacklisted)}
        icon={ICON_SHIELD_X}
        tone="danger"
        loading={loading}
        caption="Total blacklisted visitors"
      />
      <AdminKpiTile
        label="Alerts Today"
        value={String(alertsToday)}
        icon={ICON_WARN}
        tone="warning"
        loading={loading}
        captionToned={alertsToday > 0}
        caption={alertsToday > 0 ? 'Requires attention' : 'Nothing needs attention'}
      />
      <AdminKpiTile
        label="Denied Entries"
        value={String(deniedToday)}
        icon={ICON_X_CIRCLE}
        tone="danger"
        loading={loading}
        caption="Today"
      />
    </div>
  );
}
