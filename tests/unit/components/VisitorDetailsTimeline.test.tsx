import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import VisitorDetails from '../../../src/components/VisitorDetails';
import type { Visit } from '../../../src/types/index';

vi.mock('../../../src/lib/formatDate', () => ({
  formatDateTime: () => '30 Jul 2026, 10:00 AM',
  formatDuration: () => ({ text: '30m', isOvertime: false }),
  formatElapsed: () => ({ text: '30m', isOvertime: false }),
}));

const visit = {
  id: 'v1',
  ref_number: 'VIS-20260730-0001',
  status: 'approved',
  qr_token: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  created_at: '2026-07-30T09:00:00Z',
  checked_in_at: null,
  checked_out_at: null,
  rejection_reason: null,
  carrying_material: false,
  purpose: 'meeting',
  visitor: { full_name: 'John Doe', phone: '9999999999', vendor_name: 'Acme Corp', id_type: null, id_last4: null },
  department: { name: 'Engineering' },
  host: { full_name: 'Jane Smith' },
} as unknown as Visit;

afterEach(() => cleanup());

// Split out of VisitorDetails.test.tsx on 2026-08-17: the arrival/audit split
// below took that file past the 300-line ceiling. One behaviour per file — this
// one owns WHICH TIMESTAMPS EACH VIEWER MAY SEE, nothing else.
describe('VisitorDetails — timeline', () => {
  // The registration timestamp is a record-keeping detail, not something a
  // guard acts on at the gate. Approved / Checked In / Duration are.
  it('does not show a Registered row', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} />);
    expect(screen.queryByText('Registered')).not.toBeInTheDocument();
  });

  it('still shows the arrival timeline for a checked-in visit', () => {
    const inside = { ...visit, status: 'checked_in', checked_in_at: '2026-07-30T10:00:00Z' } as unknown as Visit;
    render(<VisitorDetails visit={inside} onClose={vi.fn()} />);
    expect(screen.getByText('Checked In')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.queryByText('Registered')).not.toBeInTheDocument();
  });

  // Client instruction, 2026-08-13: a guard is confirming who is standing in
  // front of them, not auditing when the visit moved between states — so the
  // whole Timeline was hidden from them.
  //
  // PARTIALLY REVERSED 2026-08-17, on the client's own instruction that a
  // scanned record must show "what time he checked in". The split keeps
  // 2026-08-13's point and drops only what contradicted the new one:
  //   ARRIVAL — Checked In / Checked Out — is now shown to a guard. It is the
  //   question a guard is actually asked, by a host chasing a visitor and by
  //   whoever is counting who is still in the building.
  //   AUDIT — Duration — stays hidden. That is still an auditor's question,
  //   and hiding it is the part of the instruction that survives.
  //
  // WIDENED AGAIN 2026-08-17, later the same day: the APPROVAL instant is now
  // shown to a guard too, on the client's instruction that the details card
  // must carry "pre-approved at" beside "checked in at" and "checked out at",
  // with the date, rather than mentioning it vaguely. A guard challenged on why
  // somebody was let in needs the moment the clearance was given. Duration is
  // what is left behind `showAudit`, and it is the right thing to leave there:
  // it is not a fact about the visit at all, it is a running subtraction.
  it('shows a guard the arrival and approval times but not the duration', () => {
    const inside = { ...visit, status: 'checked_in', checked_in_at: '2026-07-30T10:00:00Z' } as unknown as Visit;
    render(<VisitorDetails visit={inside} onClose={vi.fn()} viewerRole="guard" />);
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Checked In')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByText('Duration')).not.toBeInTheDocument();
  });

  // An approved visitor who has not arrived now DOES get a card, holding the
  // one stamp that exists for them. It is the case the 2026-08-17 widening was
  // asked for: a guard looking at a pass before the visitor is through the gate
  // should be able to see when it was cleared.
  it('shows a guard the approval time before the visitor has arrived', () => {
    const waiting = { ...visit, status: 'approved', checked_in_at: null, checked_out_at: null } as unknown as Visit;
    render(<VisitorDetails visit={waiting} onClose={vi.fn()} viewerRole="guard" />);
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByText('Checked In')).not.toBeInTheDocument();
  });

  // The card must still not appear when there is genuinely nothing in it — no
  // stamp this viewer may see and no reason to explain — so the popup does not
  // end on an empty box. `pending_approval` has no approval instant by
  // definition: nobody has decided yet.
  it('renders no timeline card for a guard when nothing has happened yet', () => {
    const unanswered = {
      ...visit, status: 'pending_approval', checked_in_at: null, checked_out_at: null,
    } as unknown as Visit;
    render(<VisitorDetails visit={unanswered} onClose={vi.fn()} viewerRole="guard" />);
    expect(screen.queryByText('Timeline')).not.toBeInTheDocument();
  });

  // The rejection reason is NOT a timestamp — it is why the visit is in the
  // state it is in, and it is the one thing a guard reading a declined row at
  // the gate has to be able to see. It survives the timeline's removal.
  it('still shows the rejection reason to a guard', () => {
    const declined = { ...visit, status: 'rejected', rejection_reason: 'Not expected today' } as unknown as Visit;
    render(<VisitorDetails visit={declined} onClose={vi.fn()} viewerRole="guard" />);
    expect(screen.getByText('Rejection Reason')).toBeInTheDocument();
    expect(screen.getByText('Not expected today')).toBeInTheDocument();
    expect(screen.queryByText('Timeline')).not.toBeInTheDocument();
  });
});
