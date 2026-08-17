import React from 'react';
import AdminKpiTile from '../../components/AdminKpiTile';
import { ICON_SHIELD_X, ICON_X_CIRCLE } from '../../lib/tileIcons';

// The same warning triangle AdminDashboardKpis draws for Overstays — kept
// local rather than exported from tileIcons.ts, matching that file's own
// precedent of a one-off glyph living beside its single caller.
const ICON_WARN = 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z';

type Props = { blacklisted: number; alerts: number; denied: number; loading: boolean };

// Three tiles, one per panel below them — no fourth "Watchlist" tile, because
// there is no watchlist table to count rows out of (see AdminWatchlistPanel).
//
// THE CAPTIONS ARE WHAT CARRIES THE LIVE-VS-HISTORICAL SPLIT (client
// instruction, 2026-08-17): the range bar above these tiles applies to two of
// the three figures and not the third, and a tile that just prints a number
// gives no clue which kind it is. `Blacklisted` says outright that the date
// range does not touch it — the flag has no history to range in the first
// place (lib/adminSecurity.ts's header). `Alerts` and `Denied Entries` say
// "in range" because their own labels used to claim "Today", which stopped
// being true the moment this tab grew a date picker; "Alerts" in particular
// mixes a ranged half (blacklist) with a live half (overstay), so its
// caption cannot promise the whole count follows the range — the panel
// beneath it (AdminSecurityAlertsPanel) is where that split is spelled out
// in full, this caption only has room to flag that it is not one single
// homogeneous thing.
export default function AdminSecurityKpis({
  blacklisted, alerts, denied, loading,
}: Props): React.ReactElement {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <AdminKpiTile
        label="Blacklisted"
        value={String(blacklisted)}
        icon={ICON_SHIELD_X}
        tone="danger"
        loading={loading}
        caption="Flagged right now — not affected by the date range"
      />
      <AdminKpiTile
        label="Alerts"
        value={String(alerts)}
        icon={ICON_WARN}
        tone="warning"
        loading={loading}
        captionToned={alerts > 0}
        caption={alerts > 0 ? 'Blacklist hits in range, plus anyone overstaying now' : 'Nothing needs attention'}
      />
      <AdminKpiTile
        label="Denied Entries"
        value={String(denied)}
        icon={ICON_X_CIRCLE}
        tone="danger"
        loading={loading}
        caption="In the selected range"
      />
    </div>
  );
}
