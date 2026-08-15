import React from 'react';
import type { Visit } from '../../types/index';
import VisitorGridCard from './VisitorGridCard';
import { SEGMENT_META, type ListSegment } from '../../lib/visitorSegments';

type Props = {
  segment: ListSegment;
  visits: Visit[];
  loading: boolean;
};

// The visitor list: heading, live count, then a CARD GRID — three across on a
// wide screen, one per visitor. Every segment that lists visits renders through
// here, so the layout is identical across Expected, Inside, Checked Out and the
// rest, and a guard learns the card once.
//
// It was a column of wide three-column rows (VisitorStackCard) until the
// console was brought onto one design language. That row was not wrong, it was
// a SECOND visitor card: the same person was drawn one way here and another way
// on Pre-Registered, so a guard crossing between them re-learned where the name,
// the host and the button sat. The grid card (VisitorGridCard) is the same face
// as PreRegisteredCard.
//
// The KPI board above this list is full width and stays that way — there is no
// right-hand rail here. A schedule rail like Pre-Registered's would restate the
// rows immediately beside it, and a filter must never render below or beside the
// content it filters.
//
// There are NO CONTROLS above the list — no search box, no sort dropdown
// (client instruction, 2026-08-13; `VisitorStackToolbar.tsx` and
// `lib/visitorStackFilter.ts` were deleted with it). The rows arrive in the
// order SEGMENT_FILTER produced them, newest activity first, and that is the
// only order there is. The search box went first, because the top bar already
// carries a global search that reaches every visit in any state
// (lib/searchVisits.ts) while a box here could only narrow the rows this
// segment had loaded. The sort followed it: a guard at a gate is looking for
// the person in front of them in a list they have already narrowed by picking
// a segment, and a control that re-orders that list is one more thing to read
// before they can act. Do not re-add a toolbar here.
export default function VisitorStackList({ segment, visits, loading }: Props): React.ReactElement {
  const meta = SEGMENT_META[segment];
  const shown = visits;

  return (
    <section className="space-y-4">
      <header className="stack-header">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="page-title">{meta.title}</h1>
            <span className="stack-count tabular-nums">{visits.length}</span>
          </div>
          <p className="page-subtitle">{meta.subtitle}</p>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[196px] w-full rounded-2xl" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="card empty-state !py-14">
          <p className="text-sm font-semibold text-navy-500">{meta.empty}</p>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">{meta.emptyHint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((v, i) => (
            <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(i, 8) * 0.035}s` }}>
              <VisitorGridCard visit={v} index={i} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
