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
//
// Two-up square tiles (`compact`), not one wide row each: eight full-width rows
// ran past the fold of a gate terminal, so the last segments — Checked Out and
// the walk-in register — could only be reached by scrolling a rail whose entire
// purpose is to be visible while you read the list beside it. On phones it
// stays a horizontal scroller above the list, where two columns would halve
// the tile width instead.
export default function VisitorKpiRail({ segment, visits, loading }: Props): React.ReactElement {
  const navigate = useNavigate();

  return (
    <aside aria-label="Visitor segments"
      className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:overflow-visible lg:pb-0">
      {VISITOR_KPI_ORDER.map((seg, i) => {
        const count = seg === 'walkin' ? null : visits.filter(SEGMENT_FILTER[seg]).length;
        return (
          <div key={seg} className="min-w-[140px] shrink-0 lg:min-w-0 lg:shrink">
            <KpiTile
              spec={VISITOR_KPIS[seg]}
              value={count}
              loading={loading}
              expanded={segment === seg}
              index={i}
              compact
              onDrill={() => navigate(segmentPath(seg))}
            />
          </div>
        );
      })}
    </aside>
  );
}