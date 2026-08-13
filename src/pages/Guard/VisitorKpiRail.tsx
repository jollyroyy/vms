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

// The Visitors page KPI board. One tile per segment, counts derived from the
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
// LAYOUT: a full-width grid ABOVE the list, in the same shape and at the same
// size as the guard dashboard's board (client instruction, 2026-08-13). It was
// a 300px column of square `compact` tiles down the right-hand side. Two
// screens that show the same kind of card in two different sizes and two
// different places make the guard re-learn the card on each one; the board is
// now the same object in both places, and the qualifier is printed on the tile
// again rather than surviving only in the accessible name.
export default function VisitorKpiRail({ segment, visits, loading }: Props): React.ReactElement {
  const navigate = useNavigate();

  return (
    <section aria-label="Visitor segments">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {VISITOR_KPI_ORDER.map((seg, i) => {
          const count = seg === 'walkin' ? null : visits.filter(SEGMENT_FILTER[seg]).length;
          return (
            <KpiTile
              key={seg}
              spec={VISITOR_KPIS[seg]}
              value={count}
              loading={loading}
              expanded={segment === seg}
              index={i}
              onDrill={() => navigate(segmentPath(seg))}
            />
          );
        })}
      </div>
    </section>
  );
}
