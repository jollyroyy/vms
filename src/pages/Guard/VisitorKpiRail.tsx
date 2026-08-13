import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Visit } from '../../types/index';
import { SEGMENT_FILTER, segmentPath, type VisitorSegment } from '../../lib/visitorSegments';
import { VISITOR_KPIS, VISITOR_KPI_ORDER } from './visitorKpis';
import KpiTile from '../../components/KpiTile';

type Props = {
  segment: VisitorSegment;
  visits: Visit[];
  loading: boolean;
};

// The Visitors page KPI rail. One tile per segment, counts derived from the
// page's OWN loaded array — the same window and the same SEGMENT_FILTER the
// list under it uses, so a number here can never disagree with the list it
// filters (the rule the old sidebar badges lived by, kept in place).
//
// Clicking a tile navigates to the segment's URL (/visitors/expected, …), so
// the filter is a real route: bookmarkable, and the back button walks the
// guard through the segments they just looked at. The tile matching the
// current segment reads as expanded; the rest are filters.
//
// The walk-in tile is the one non-list destination on the board — the register
// is a form, not a slice — so it carries no count and just opens the lane.
export default function VisitorKpiRail({ segment, visits, loading }: Props): React.ReactElement {
  const navigate = useNavigate();

  return (
    <aside aria-label="Visitor segments"
      className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-1 lg:gap-2.5 lg:overflow-visible lg:pb-0">
      {VISITOR_KPI_ORDER.map((seg, i) => {
        const count = seg === 'walkin' ? null : visits.filter(SEGMENT_FILTER[seg]).length;
        return (
          <div key={seg} className="min-w-[168px] shrink-0 lg:min-w-0 lg:shrink">
            <KpiTile
              spec={VISITOR_KPIS[seg]}
              value={count}
              loading={loading}
              expanded={segment === seg}
              index={i}
              onDrill={() => navigate(segmentPath(seg))}
            />
          </div>
        );
      })}
    </aside>
  );
}