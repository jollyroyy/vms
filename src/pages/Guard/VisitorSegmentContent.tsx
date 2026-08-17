import React from 'react';
import type { Visit } from '../../types/index';
import VisitorStackList from './VisitorStackList';
import GuardWalkIns from './GuardWalkIns';
import GuardWalkInApproved from './GuardWalkInApproved';
import type { WalkInCheckIn } from '../../lib/checkInWalkInApproved';
import { SEGMENT_META, segmentVisits, type ListSegment, type VisitorSegment } from '../../lib/visitorSegments';
import { isAwaitingGateCheckIn } from '../../lib/visitOrigin';

/** Heading + subtitle for a segment that is a flow rather than a list.
 *  VisitorStackList renders its own; this keeps the two kinds consistent.
 *
 *  `eyebrow` is a KICKER above the h1, not a second heading: it names the board
 *  a guard is standing on ("Walk-in Visitors at a Glance", client instruction
 *  2026-08-17) while the h1 underneath still names this particular lane. It is
 *  a <p>, so the page keeps exactly one h1 and the heading order stays
 *  h1 → h2 (the lane's own "Awaiting gate check-in"). */
function SegmentShell(
  { segment, eyebrow, children }:
  { segment: VisitorSegment; eyebrow?: string; children: React.ReactNode },
) {
  const meta = SEGMENT_META[segment];
  return (
    <section className="space-y-4">
      <header>
        {eyebrow && (
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700 mb-1.5">
            <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            {eyebrow}
          </p>
        )}
        <h1 className="page-title">{meta.title}</h1>
        <p className="page-subtitle">{meta.subtitle}</p>
      </header>
      {children}
    </section>
  );
}

/** The kicker over the walk-in gate lane. Only this segment carries it: the
 *  register's own h1 is already "Walk-in Visitors", and printing the phrase
 *  directly above those same two words would be the duplicate render the rest
 *  of this surface is built to avoid. */
const WALK_IN_GLANCE = 'Walk-in Visitors at a Glance';

type Props = {
  segment: VisitorSegment;
  visits: Visit[];
  loading: boolean;
  busyId: string | null;
  onWalkInCheckIn: (v: Visit, details: WalkInCheckIn) => void;
  onWalkInSubmitted: (name: string) => void;
};

// Segment → what renders. Two of the eight are not lists at all:
//
//   walkin         — the registration form. UNCHANGED from the tab-bar era:
//                    a guard still has to be able to register someone who
//                    turned up unannounced, and that flow is the one thing on
//                    this surface that creates a visit rather than advancing
//                    one. It kept its own pending list because registering and
//                    then watching for the host's answer is one continuous job.
//   walkinApproved — captures a photo at the gate before it can act, so it is
//                    a flow with its own component, not a row with a button.
//
// The other six are the same stacked list with a different slice — a card grid
// with NO action (client instruction, 2026-08-14): the Visitors tab only shows
// which visitor falls under which category, and check-in / check-out happen on
// their own desks, never from a card in a category list.
export default function VisitorSegmentContent(props: Props): React.ReactElement {
  const { segment, visits, loading } = props;

  // The two flow segments get the same heading treatment as the six lists.
  // Without it they were the only segments a guard could land on with nothing
  // on screen naming where they are — the nav item they clicked scrolls out of
  // view on a short terminal, and the page then looks like it loaded blank.
  if (segment === 'walkin') {
    return (
      <SegmentShell segment="walkin">
        {/* The register carries the gate check-in as well as the registration
            (client instruction, 2026-08-17). `awaitingGateCheckIn` is the
            NARROW half of the walkinApproved segment — cleared and still
            outside — so the same visitor's Check In button appears here and on
            the Approved Walk-ins lane, and it is the same component in both. */}
        <GuardWalkIns
          loading={loading}
          pending={segmentVisits(visits, 'pending')}
          awaitingCheckIn={segmentVisits(visits, 'walkinApproved').filter(isAwaitingGateCheckIn)}
          busyId={props.busyId}
          onCheckIn={props.onWalkInCheckIn}
          onSubmitted={props.onWalkInSubmitted}
        />
      </SegmentShell>
    );
  }

  if (segment === 'walkinApproved') {
    return (
      <SegmentShell segment="walkinApproved" eyebrow={WALK_IN_GLANCE}>
        <GuardWalkInApproved
          loading={loading}
          approved={segmentVisits(visits, 'walkinApproved')}
          busyId={props.busyId}
          onCheckIn={props.onWalkInCheckIn}
        />
      </SegmentShell>
    );
  }

  const rows = segmentVisits(visits, segment as ListSegment);

  return (
    <VisitorStackList
      segment={segment as ListSegment}
      visits={rows}
      loading={loading}
    />
  );
}
