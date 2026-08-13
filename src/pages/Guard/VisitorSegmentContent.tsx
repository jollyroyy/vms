import React from 'react';
import type { Visit } from '../../types/index';
import VisitorStackList from './VisitorStackList';
import GuardWalkIns from './GuardWalkIns';
import GuardWalkInApproved, { type WalkInCheckIn } from './GuardWalkInApproved';
import type { StackAction } from './VisitorStackCard';
import { SEGMENT_META, segmentVisits, type ListSegment, type VisitorSegment } from '../../lib/visitorSegments';

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
  onCheckIn: (v: Visit) => void;
  onCheckOut: (v: Visit) => void;
  onWalkInCheckIn: (v: Visit, details: WalkInCheckIn) => void;
  onWalkInSubmitted: (name: string) => void;
  onSelect: (v: Visit) => void;
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
// The other six are the same stacked list with a different slice and a
// different action, which is the point: one card, learned once.
export default function VisitorSegmentContent(props: Props): React.ReactElement {
  const { segment, visits, loading } = props;

  // The two flow segments get the same heading treatment as the six lists.
  // Without it they were the only segments a guard could land on with nothing
  // on screen naming where they are — the nav item they clicked scrolls out of
  // view on a short terminal, and the page then looks like it loaded blank.
  if (segment === 'walkin') {
    return (
      <SegmentShell segment="walkin">
        <GuardWalkIns
          loading={loading}
          pending={segmentVisits(visits, 'pending')}
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
      onSelect={props.onSelect}
      actionFor={(v) => actionFor(v, props)}
    />
  );
}

// The action a row offers depends on the visit, not on the segment heading —
// "All Visitors" mixes an expected arrival and a departed one on the same
// screen, and each must offer what it can actually do.
function actionFor(v: Visit, p: Props): StackAction | undefined {
  if (v.status === 'approved') {
    return { label: 'Check In', onClick: () => p.onCheckIn(v) };
  }
  if (v.status === 'checked_in') {
    return { label: 'Check Out', onClick: () => p.onCheckOut(v), disabled: p.busyId === v.id };
  }
  // pending_approval waits on a host, walkin_approved needs the photo flow on
  // its own segment, and a closed visit has nothing left to do. None of those
  // get a button the guard cannot honour.
  return undefined;
}
