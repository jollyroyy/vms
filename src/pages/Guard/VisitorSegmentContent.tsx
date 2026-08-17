import React from 'react';
import type { Visit } from '../../types/index';
import VisitorStackList from './VisitorStackList';
import GuardWalkIns from './GuardWalkIns';
import GuardWalkInApproved from './GuardWalkInApproved';
import type { WalkInCheckIn } from '../../lib/checkInWalkInApproved';
import { SEGMENT_META, segmentVisits, type ListSegment, type VisitorSegment } from '../../lib/visitorSegments';
import { isAwaitingGateCheckIn } from '../../lib/visitOrigin';

/** Heading + subtitle for a segment that is a flow rather than a list.
 *  VisitorStackList renders its own; this keeps the two kinds consistent. */
function SegmentShell({ segment, children }: { segment: VisitorSegment; children: React.ReactNode }) {
  const meta = SEGMENT_META[segment];
  return (
    <section className="space-y-4">
      <header>
        <h1 className="page-title">{meta.title}</h1>
        <p className="page-subtitle">{meta.subtitle}</p>
      </header>
      {children}
    </section>
  );
}

type Props = {
  segment: VisitorSegment;
  visits: Visit[];
  loading: boolean;
  busyId: string | null;
  onWalkInCheckIn: (v: Visit, details: WalkInCheckIn) => void;
  onWalkInSubmitted: (name: string) => void;
  /** Ends a walk-in's visit from the same desk that started it. See the note on
   *  GuardWalkInApproved: the write stays in lib/checkOutFlow, shared with the
   *  Entry & Exit tab. */
  onWalkInCheckOut: (v: Visit) => void;
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
      <SegmentShell segment="walkinApproved">
        <GuardWalkInApproved
          loading={loading}
          approved={segmentVisits(visits, 'walkinApproved')}
          busyId={props.busyId}
          onCheckIn={props.onWalkInCheckIn}
          onCheckOut={props.onWalkInCheckOut}
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
