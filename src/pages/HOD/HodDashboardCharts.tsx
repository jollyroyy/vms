import React, { useMemo } from 'react';
import type { Visit } from '../../types/index';
import ChartCard from '../../components/charts/ChartCard';
import LineChart from '../../components/charts/LineChart';
import DonutChart from '../../components/charts/DonutChart';
import UtilizationRows from '../../components/charts/UtilizationRows';
import { hourlyFlow, purposeSplit, topHosts } from '../../lib/adminDashboard';
import { chartColor } from '../../lib/chartPalette';
import { initialsOf } from '../../lib/initials';

// The HOD dashboard's chart band — the admin Dashboard's three charts, over
// this HOD's own department (client instruction, 2026-08-17: "in hod view also
// create similar visual dashboard as done for admin, but scope should be their
// own meeting data").
//
// NO SECOND QUERY, AND THAT IS THE WHOLE DESIGN. Every series here is a pure
// function over the same `Visit[]` the KPI tiles above are counting — the rows
// HODConsole already fetched for its desks. This is the rule the admin
// Dashboard states in its own header and the rule the guard board's 2026-08-14
// rebuild established: two answers to "what happened today" on one screen, with
// nothing forcing them to agree, is the tile-vs-drilldown defect this project
// has already fixed twice. The Checked In tile and the flow chart under it
// count the same arrivals from the same array, so they cannot disagree.
//
// THE FUNCTIONS ARE `lib/adminDashboard.ts`'s, IMPORTED, NOT COPIED. They take
// an array and a clock and hold no admin-ness at all — the scoping is done by
// WHICH ROWS ARE PASSED IN, which for an HOD is their department's, because
// HODConsole's query is `.eq('department_id', deptId)` and the RLS behind it
// says the same thing a second time. Re-deriving "arrivals per hour" here would
// be a second definition of an IST hour, and this file has a whole section on
// what happens when a rule gets retyped at a new call site.
//
// WHAT IS NOT HERE: the admin's Live Lobby Feed. Its rows are the drill-down
// panel the KPI board directly above already renders — press Checked In and you
// have it, sorted, with more columns. On the admin Dashboard that feed is the
// only list on the screen; here it would be the second.

type Props = {
  /** Today's department visits — created, arrived or departed today. */
  visits: Visit[];
  now: Date;
};

export default function HodDashboardCharts({ visits, now }: Props): React.ReactElement {
  const flow = useMemo(() => hourlyFlow(visits, now), [visits, now]);
  const purposes = useMemo(() => purposeSplit(visits, now), [visits, now]);
  const hosts = useMemo(() => topHosts(visits, now), [visits, now]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2">
        <ChartCard
          heading="Visitor Flow"
          about="Your department's arrivals per hour, counted at the moment the gate checked each visitor in."
        >
          <LineChart
            points={flow}
            seriesLabel="Visitors"
            color={chartColor(0)}
            emptyMessage="Nobody has checked in to this department yet today."
          />
        </ChartCard>
      </div>

      <ChartCard
        heading="Visit Purpose"
        about="Today's arrivals to your department, by the purpose recorded on the visit."
      >
        <DonutChart
          slices={purposes}
          unit="arrivals"
          emptyMessage="No arrivals to break down yet."
        />
      </ChartCard>

      <div className="xl:col-span-3">
        <ChartCard
          heading="Busiest Hosts"
          about="People in your department ranked by how many visitors they received today."
        >
          {/* The avatar the admin board draws is deliberately absent: this
              board's rows come through `attachHostNames`, whose RPC returns a
              name and a department and no `avatar_url`. A monogram is the
              honest render of "we did not fetch a photo"; reaching for one
              would mean a second round trip per host to decorate a ranking. */}
          <UtilizationRows
            headers={['Host', 'Share', 'Visitors']}
            unit="visitors"
            showShare
            rows={hosts.map((h, i) => ({
              label: h.label,
              value: h.value,
              lead: (
                <span className="shrink-0 flex items-center gap-1.5">
                  <span className="w-4 shrink-0 text-[11px] tabular-nums text-navy-500 text-right">
                    {i + 1}
                  </span>
                  <span className="w-7 h-7 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400
                                   text-[11px] font-semibold flex items-center justify-center">
                    {initialsOf(h.label)}
                  </span>
                </span>
              ),
            }))}
            emptyMessage="No arrivals today, so there is nobody to rank."
          />
        </ChartCard>
      </div>
    </div>
  );
}
