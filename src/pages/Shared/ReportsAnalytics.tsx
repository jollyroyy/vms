import React, { useMemo } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';
import DonutChart from '../../components/charts/DonutChart';
import { chartColor } from '../../lib/chartPalette';
import { visitorsByDay, checkinTimeTrend, formatSeconds } from '../../lib/adminReports';
import { PURPOSE_LABELS } from '../../lib/adminDashboard';
import type { ReportVisit } from '../../lib/reportRow';
import type { VisitorPurpose } from '../../types/index';

type Props = {
  visits: ReportVisit[];
  /** The register's own range, so the charts and the table below them cannot
   *  describe different periods — they are handed the same rows and the same
   *  bounds rather than each computing a window. */
  from: string;
  to: string;
};

// The analytics band above the Reports register: visitors by day, the check-in
// time trend and the purpose split.
//
// THERE IS NO ENTRY POINT UTILIZATION CARD (removed 2026-08-17, client
// instruction) — see the note in `lib/adminReports.ts` for why, and do not add
// a fourth card back from `visits.entry_point_id` until something writes it.
//
// It lives on Reports rather than on a page of its own because `/analytics` was
// DELETED on 2026-08-17, not unlinked. Two screens answering "what happened
// this week" from separately written queries is the tile-vs-drilldown defect
// this project has already fixed once; here the charts are derived from the
// exact array of rows the register prints, so a bar and the lines under it are
// the same visits counted twice rather than fetched twice.
//
// `no-print` on the wrapper: `styles/print.css` pins the register's seventeen
// column widths by `nth-child`, and the printed artefact is the register. A
// chart on paper would push it to a second page for no gain.

export default function ReportsAnalytics({ visits, from, to }: Props): React.ReactElement {
  const byDay = useMemo(() => visitorsByDay(visits, from, to), [visits, from, to]);
  const trend = useMemo(() => checkinTimeTrend(visits, from, to), [visits, from, to]);

  const purposes = useMemo(() => {
    const counts = new Map<VisitorPurpose, number>();
    for (const v of visits) {
      if (!v.checked_in_at) continue;
      counts.set(v.purpose, (counts.get(v.purpose) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([purpose, value]) => ({ label: PURPOSE_LABELS[purpose] ?? purpose, value }));
  }, [visits]);

  return (
    <div className="no-print">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <ChartCard heading="Visitors by Day"
                   about="Arrivals per day, counted at the moment the gate checked each visitor in.">
          <BarChart bars={byDay} seriesLabel="Visitors" color={chartColor(0)}
                    emptyMessage="No arrivals in this range." />
        </ChartCard>

        <ChartCard
          heading="Avg Check-in Time Trend"
          about="Mean time the desk took to complete a check-in. Days on which nothing was timed are left out rather than plotted as zero seconds."
        >
          {/* The series is legitimately short on any range reaching back before
              migration 088 — nothing recorded a duration then. The card says
              how many days it actually covers rather than letting a two-point
              line imply the week was quiet. */}
          <LineChart points={trend} seriesLabel="Avg check-in time" color={chartColor(1)}
                     formatValue={formatSeconds}
                     emptyMessage="No check-in in this range was timed." />
          {trend.length > 0 && trend.length < byDay.length && (
            <p className="text-xs text-navy-500 text-center mt-1">
              {trend.length} of {byDay.length} days carried a measured check-in.
            </p>
          )}
        </ChartCard>

        <ChartCard heading="Visit Purpose Split"
                   about="Arrivals in this range by the purpose recorded on the visit.">
          <DonutChart slices={purposes} unit="arrivals"
                      emptyMessage="No arrivals to break down." />
        </ChartCard>
      </div>
    </div>
  );
}
