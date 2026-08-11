import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import VisitorDetails from '../../../src/components/VisitorDetails';
import type { Visit } from '../../../src/types/index';

// Own file rather than growing VisitorDetails.test.tsx, which is already at 275
// lines against the 300-line cap in CLAUDE.md.
vi.mock('../../../src/lib/formatDate', () => ({
  formatDateTime: (iso: string) => `formatted:${iso}`,
  formatDuration: () => ({ text: '30m', isOvertime: false }),
  formatElapsed: () => ({ text: '30m', isOvertime: false }),
}));

const visit = {
  id: 'v1',
  ref_number: 'VIS-20260810-0004',
  status: 'approved',
  qr_token: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  created_at: '2026-08-10T09:00:00Z',
  scheduled_for: '2026-08-11T10:55:00Z',
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

// The ref number is printed on the pass itself, one click away under View Pass
// — the copy the visitor shows and the guard reads back. Repeating it in the
// modal chrome spent the popup's most prominent line on a value nobody acts on
// at that point.
describe('VisitorDetails — the ref number is not in the header', () => {
  it('does not print the ref number above the visitor card', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} viewerRole="hod" />);
    expect(screen.queryByText('VIS-20260810-0004')).not.toBeInTheDocument();
  });

  it('still leads with the visitor, not the reference', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} viewerRole="hod" />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});

// The time the HOD chose when raising the pass. It is the only field the
// approver picked themselves, and the only thing that says whether a visitor is
// early, expected or overdue — none of which the status can answer.
describe('VisitorDetails — expected time of visit', () => {
  it('shows the scheduled time the HOD set', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} viewerRole="hod" />);
    expect(screen.getByText('Expected At')).toBeInTheDocument();
    expect(screen.getByText('formatted:2026-08-11T10:55:00Z')).toBeInTheDocument();
  });

  it('shows it to the guard too', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} viewerRole="guard" />);
    expect(screen.getByText('Expected At')).toBeInTheDocument();
  });

  // A walk-in has no scheduled_for by construction — WalkInRequest inserts it
  // as null — so the row is omitted rather than showing a dash on every walk-in.
  it('omits the row entirely for a walk-in', () => {
    const walkIn = { ...visit, status: 'walkin_approved', scheduled_for: null } as unknown as Visit;
    render(<VisitorDetails visit={walkIn} onClose={vi.fn()} viewerRole="guard" />);
    expect(screen.queryByText('Expected At')).not.toBeInTheDocument();
  });
});
