import React from 'react';
import AdminKpiTile from '../../components/AdminKpiTile';
import type { AdminKpis } from '../../lib/adminDashboard';
import { formatSeconds } from '../../lib/adminReports';
import {
  ICON_PEOPLE, ICON_CHECK_CIRCLE, ICON_CLOCK, ICON_CALENDAR,
} from '../../lib/tileIcons';

const ICON_WARN = 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z';
const ICON_SMILE = 'M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z';

type Props = { kpis: AdminKpis; loading: boolean };

// The dashboard's six tiles, in the reference screen's order.
//
// EVERY CAPTION EITHER STATES A COMPARISON OR NAMES WHAT THE FIGURE IS OF.
// Where the comparison cannot be made — yesterday was zero, nothing was
// measured, nobody has rated a visit — the caption says so in words rather than
// printing a plausible-looking number. A dashboard tile is the shortest thing
// on the screen and therefore the most likely to be quoted onward, so a figure
// here that the system cannot stand behind travels further than one anywhere
// else.

export default function AdminDashboardKpis({ kpis, loading }: Props): React.ReactElement {
  const change = kpis.changeVsYesterday;
  const arrow = change === null ? '' : change > 0 ? '↗ ' : change < 0 ? '↘ ' : '';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      <AdminKpiTile
        label="Visitors Today"
        value={String(kpis.visitorsToday)}
        icon={ICON_PEOPLE}
        tone="brand"
        loading={loading}
        captionToned={change !== null && change !== 0}
        caption={change === null
          ? 'No arrivals yesterday to compare'
          : `${arrow}${Math.abs(change)}% vs yesterday`}
      />

      <AdminKpiTile
        label="Currently Inside"
        value={String(kpis.currentlyInside)}
        icon={ICON_CHECK_CIRCLE}
        tone="success"
        loading={loading}
        caption="Live in facility"
      />

      <AdminKpiTile
        label="Avg Check-in Time"
        value={kpis.avgCheckinSeconds === null ? 'Not measured' : formatSeconds(kpis.avgCheckinSeconds)}
        icon={ICON_CLOCK}
        tone="brand"
        loading={loading}
        caption={kpis.avgCheckinSeconds === null
          ? 'No check-in was timed today'
          : `Across ${kpis.avgCheckinSampleSize} check-in${kpis.avgCheckinSampleSize === 1 ? '' : 's'}`}
      />

      {/* Two figures on one tile, matching the reference screen. They are the
          two ROUTES in, and they sum to Visitors Today — so the tile is a split
          of the first tile rather than a second, differently-derived total. */}
      <AdminKpiTile
        label="Pre-registered"
        value={`${kpis.preRegistered} / ${kpis.walkIn}`}
        icon={ICON_CALENDAR}
        tone="brand"
        loading={loading}
        caption="Pre-approved / Walk-in"
      />

      <AdminKpiTile
        label="Overstays"
        value={String(kpis.overstays)}
        icon={ICON_WARN}
        tone="warning"
        loading={loading}
        captionToned={kpis.overstays > 0}
        caption={kpis.overstays > 0 ? 'Requires attention' : 'Nobody is overdue'}
      />

      <AdminKpiTile
        label="Guest Satisfaction"
        value={kpis.satisfaction === null ? 'No ratings' : `${kpis.satisfaction.toFixed(1)} ★`}
        icon={ICON_SMILE}
        tone="violet"
        loading={loading}
        caption={kpis.reviewCount === 0
          ? 'No visitor has rated today'
          : `Based on ${kpis.reviewCount} review${kpis.reviewCount === 1 ? '' : 's'}`}
      />
    </div>
  );
}
