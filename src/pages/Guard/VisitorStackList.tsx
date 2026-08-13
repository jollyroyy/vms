import React, { useMemo, useState } from 'react';
import type { Visit } from '../../types/index';
import VisitorStackCard, { type StackAction } from './VisitorStackCard';
import VisitorStackToolbar from './VisitorStackToolbar';
import { sortVisits, type StackSort } from '../../lib/visitorStackFilter';
import { SEGMENT_META, type ListSegment } from '../../lib/visitorSegments';

type Props = {
  segment: ListSegment;
  visits: Visit[];
  loading: boolean;
  /** Per-row primary action. Returning undefined renders no button — an
   *  Overstayed row and an Inside row are the same visit, but only one of them
   *  is a list a guard checks people out from. */
  actionFor?: (v: Visit) => StackAction | undefined;
  onSelect?: (v: Visit) => void;
};

// The stacked list: heading, live count, toolbar, then one wide card per
// visitor. Every segment that lists visits renders through here, so the layout
// is identical across Expected, Inside, Overstayed and the rest — a guard
// learns the card once.
export default function VisitorStackList({
  segment, visits, loading, actionFor, onSelect,
}: Props): React.ReactElement {
  const meta = SEGMENT_META[segment];
  const [sort, setSort] = useState<StackSort>('recent');

  // No search box. The top bar already carries a global search that reaches
  // every visit in any state (lib/searchVisits.ts); a second box here searched
  // only the rows already on screen, so the same query gave two different
  // answers depending on which field the guard happened to type into.
  const shown = useMemo(() => sortVisits(visits, sort), [visits, sort]);

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

      <VisitorStackToolbar sort={sort} onSortChange={setSort} />

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[148px] w-full rounded-2xl" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="card empty-state !py-14">
          <p className="text-sm font-semibold text-navy-500">{meta.empty}</p>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">{meta.emptyHint}</p>
        </div>
      ) : (
        <div className="stack-list">
          {shown.map((v, i) => (
            <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(i, 8) * 0.035}s` }}>
              <VisitorStackCard visit={v} action={actionFor?.(v)} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
