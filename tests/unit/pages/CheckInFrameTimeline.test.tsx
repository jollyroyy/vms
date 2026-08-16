// The Inside Now check-in frame must show WHEN each stage happened, and must
// not repeat what the table above it already prints.
//
// This replaced CheckInFrameLegibility.test.tsx, which guarded the wrapping of
// the "Check-In Details" card's values. That card is gone (2026-08-15, client
// instruction): Visitor Name, Company, Purpose and Host are the exact columns
// of the Inside Now table directly above the frame, on the row the guard
// clicked to open it, so the card rendered every one of them twice on one
// screen.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import CheckInFrame from '../../../src/pages/Guard/CheckInFrame';
import type { ReportVisit } from '../../../src/lib/reportRow';

afterEach(cleanup);

const LONG_VENDOR = 'Whitfield & Partners Facilities Management Private Limited';
const LONG_HOST = 'Dharmendra Kumar Rajagopalan';

function visit(over: Partial<ReportVisit> = {}): ReportVisit {
  return {
    id: 'v1',
    ref_number: 'VIS-20260814-2417',
    status: 'checked_in',
    purpose: 'Meeting with D. Kumar',
    created_at: '2026-08-14T03:00:00Z',
    scheduled_for: '2026-08-14T05:00:00Z',
    approvedAt: '2026-08-14T03:00:00Z',
    checked_in_at: '2026-08-14T05:00:00Z',
    checked_out_at: null,
    photo_data: 'data:image/png;base64,abc',
    visitor: { full_name: 'Sarah Whitfield', vendor_name: LONG_VENDOR, vehicle_number: 'KA 05 AB 1234', id_type: 'PAN' },
    host: { full_name: LONG_HOST },
    department: { name: 'Information Technology' },
    ...over,
  } as unknown as ReportVisit;
}

function renderFrame(v: ReportVisit = visit()) {
  return render(
    <CheckInFrame
      activeVisit={v}
      qrDataUrl={null}
      onPrintBadge={() => {}}
      onClose={() => {}}
    />,
  );
}

describe('CheckInFrame — visit timeline', () => {
  // Scoped to the timeline, because the printable pass beside it carries the
  // same three instants since 2026-08-15 (client instruction: the badge must
  // stand on its own once it leaves the screen). That is the pass being its own
  // content — the precedent the visitor's name and the date already set here —
  // not the frame stating one fact twice.
  it('shows the approval, scheduled slot, check-in and check-out stages with their times', () => {
    renderFrame(visit({ status: 'checked_out', checked_out_at: '2026-08-14T12:00:00Z' }));
    expect(screen.getByText('Visit Timeline')).toBeInTheDocument();
    const timeline = screen.getByText('Visit Timeline').closest('div')?.parentElement as HTMLElement;
    expect(within(timeline).getByText('Approved')).toBeInTheDocument();
    // The pre-approver's own slot (client instruction, 2026-08-15) — the one
    // time on a visit a human chose, and what every arrival is judged against.
    expect(within(timeline).getByText('Scheduled')).toBeInTheDocument();
    expect(within(timeline).getByText('Checked in')).toBeInTheDocument();
    expect(within(timeline).getByText('Checked out')).toBeInTheDocument();
    // 05:00Z = 10:30 IST (the slot AND the entry, on this fixture),
    // 12:00Z = 17:30 IST.
    expect(screen.getAllByText(/10:30/).length).toBeGreaterThan(0);
    expect(within(timeline).getByText(/5:30|17:30/)).toBeInTheDocument();
  });

  it('prints the date exactly once when every stage falls on the same IST day', () => {
    renderFrame(visit({ status: 'checked_out', checked_out_at: '2026-08-14T12:00:00Z' }));
    // Scoped to the timeline itself: its header prints the date once and each
    // row a bare time. The pass beside it (CheckInBadgeRail) carries its own
    // "Valid until" date — the pass is its own content, not a restatement of
    // the timeline, exactly like the visitor name on the pass.
    const timelineRoot = screen.getByText('Visit Timeline').closest('div')?.parentElement as HTMLElement;
    expect(within(timelineRoot).getAllByText(/14 Aug 2026/).length).toBe(1);
    // The three rows print times, not dates.
    expect(within(timelineRoot).queryAllByText(/10:30/).length).toBeGreaterThan(0);
  });

  it('omits the approval stage for a walk-in', () => {
    renderFrame(visit({ scheduled_for: null, approvedAt: null } as never));
    expect(screen.queryByText('Approved')).toBeNull();
    const timeline = screen.getByText('Visit Timeline').closest('div')?.parentElement as HTMLElement;
    expect(within(timeline).getByText('Checked in')).toBeInTheDocument();
  });

  it('renders no timeline at all when no stage has a time yet', () => {
    renderFrame(visit({ status: 'pending_approval', scheduled_for: null, approvedAt: null, checked_in_at: null } as never));
    expect(screen.queryByText('Visit Timeline')).toBeNull();
  });
});

describe('CheckInFrame — no Check-In Details card', () => {
  it('does not repeat the table columns (name aside, which is on the pass)', () => {
    renderFrame();
    expect(screen.queryByText('Check-In Details')).toBeNull();
    expect(screen.queryByText(LONG_VENDOR)).toBeNull();
    expect(screen.queryByText('Meeting with D. Kumar')).toBeNull();
    // The visitor's name survives ONCE, on the printable pass — that is the
    // pass's own content, not a restatement of the table.
    expect(screen.getAllByText('Sarah Whitfield').length).toBe(1);
    // The HOST survives once too, and for the same reason (client instruction,
    // 2026-08-16). It is on the pass now — the piece of paper that leaves with
    // the visitor and has to say who they came to see. That is the pass's own
    // content, not the deleted Check-In Details card coming back: the rule was
    // never "the host may not appear", it was "no second card restating the
    // table". ONCE is what this asserts, and once is what makes it not a
    // duplicate render.
    expect(screen.getAllByText(new RegExp(LONG_HOST)).length).toBe(1);
  });

  it('keeps the one thing the table does not carry: the vehicle', () => {
    renderFrame();
    expect(screen.getByText('KA 05 AB 1234')).toBeInTheDocument();
  });

  // Removed 2026-08-15 (client instruction). The host is notified by the
  // check-in itself (lib/notifyHostCheckIn.ts, fired on every path that writes
  // checked_in), so the button could only re-raise a notice that already
  // exists. The "Host Notified" step stays — it reports that notice.
  it('has no Notify Host button, because the check-in already notified them', () => {
    renderFrame();
    expect(screen.queryByRole('button', { name: /notify host/i })).toBeNull();
    expect(screen.getByText('Host Notified')).toBeInTheDocument();
  });

  it('drops the disabled one-option Badge type select with the card', () => {
    const { container } = renderFrame();
    expect(container.querySelectorAll('select').length).toBe(0);
    expect(container.querySelectorAll('input').length).toBe(0);
  });
});
