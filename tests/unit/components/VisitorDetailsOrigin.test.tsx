import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import VisitorDetails from '../../../src/components/VisitorDetails';
import type { Visit } from '../../../src/types/index';

// Own file rather than growing VisitorDetails.test.tsx or the header file,
// both of which are already close to the 300-line cap in CLAUDE.md.
vi.mock('../../../src/lib/formatDate', () => ({
  formatDateTime: (iso: string) => `formatted:${iso}`,
  formatDuration: () => ({ text: '30m', isOvertime: false }),
  formatElapsed: () => ({ text: '30m', isOvertime: false }),
}));

const base = {
  id: 'v1',
  ref_number: 'VIS-20260816-0004',
  status: 'checked_in',
  qr_token: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  created_at: '2026-08-16T09:00:00Z',
  scheduled_for: null,
  checked_in_at: '2026-08-16T10:00:00Z',
  checked_out_at: null,
  rejection_reason: null,
  carrying_material: false,
  purpose: 'meeting',
  visitor: { full_name: 'John Doe', phone: '9999999999', vendor_name: 'Acme Corp', id_type: null, id_last4: null },
  department: { name: 'Engineering' },
  host: { full_name: 'Jane Smith' },
} as unknown as Visit;

const walkIn = base;
const preApproved = { ...base, scheduled_for: '2026-08-16T10:55:00Z' } as unknown as Visit;

afterEach(() => cleanup());

// "always everybody should be able to see who is walk-in and who is
// pre-approved" (client instruction, 2026-08-16). Every list carries the answer
// — the guard board's Type of Visitor column, the grid card's outline chip, the
// Entry & Exit table, the check-in summary — but the popup those lists OPEN did
// not, so the one surface a guard reaches by clicking a visitor was the one that
// could not say which desk they came through.
describe('VisitorDetails — which desk the visitor came through', () => {
  it('names the row with the words the rest of the app uses', () => {
    render(<VisitorDetails visit={walkIn} onClose={vi.fn()} viewerRole="guard" />);
    expect(screen.getByText('Type of Visitor')).toBeInTheDocument();
  });

  it('says Walk-in for a visitor who turned up unannounced', () => {
    render(<VisitorDetails visit={walkIn} onClose={vi.fn()} viewerRole="guard" />);
    expect(screen.getByText('Walk-in')).toBeInTheDocument();
  });

  it('says Pre-approved for a visitor who was booked ahead', () => {
    render(<VisitorDetails visit={preApproved} onClose={vi.fn()} viewerRole="guard" />);
    expect(screen.getByText('Pre-approved')).toBeInTheDocument();
  });

  // The converged case is the whole point. Both routes land on `checked_in`, so
  // from that status on the badge cannot say it and only lib/visitOrigin can.
  it('answers on a checked-in row, where the status badge no longer can', () => {
    render(<VisitorDetails visit={walkIn} onClose={vi.fn()} viewerRole="guard" />);
    expect(screen.getByText('checked in')).toBeInTheDocument();
    expect(screen.getByText('Walk-in')).toBeInTheDocument();
  });

  // The HOD's copy has no ID tab, but the origin is not an identity document —
  // it is how the visit was raised, which is the approver's own subject.
  it('shows it to the HOD as well as the guard', () => {
    render(<VisitorDetails visit={preApproved} onClose={vi.fn()} viewerRole="hod" />);
    expect(screen.getByText('Type of Visitor')).toBeInTheDocument();
    expect(screen.getByText('Pre-approved')).toBeInTheDocument();
  });

  // CLAUDE.md's no-duplicate-renders rule: one value, one place on the card.
  it('prints the answer exactly once', () => {
    render(<VisitorDetails visit={walkIn} onClose={vi.fn()} viewerRole="guard" />);
    expect(screen.getAllByText('Type of Visitor')).toHaveLength(1);
    expect(screen.getAllByText('Walk-in')).toHaveLength(1);
  });
});
