import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import VisitorDetails from '../../../src/components/VisitorDetails';
import type { Visit } from '../../../src/types/index';

// The ID tab (client instruction, 2026-08-15). Its own file rather than another
// describe in VisitorDetails.test.tsx, which was already at the 300-line
// ceiling: that file is about the popup's chrome — closing, the timeline, the
// pass — and this one is about the single question the tab exists to answer,
// "what document did we take off this person, and does the face match?".
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

// An HOD approves on who is visiting and why — confirming a government ID
// against a face is the guard's job at the gate, not the HOD's, so the ID
// document must not appear anywhere on the HOD's copy of this popup.
describe('VisitorDetails — ID document is hidden from an HOD', () => {
  afterEach(() => cleanup());

  const withId = { ...visit, visitor: { ...visit.visitor, id_type: 'Aadhaar', id_last4: '9646' } } as unknown as Visit;

  // Since 2026-08-15 the ID lives behind its own tab. The HOD gets no such tab
  // at all, rather than a tab that opens onto a refusal.
  it('offers an HOD no ID tab', () => {
    render(<VisitorDetails visit={withId} onClose={vi.fn()} viewerRole="hod" />);
    expect(screen.queryByRole('tab', { name: /id/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Aadhaar ••••46')).not.toBeInTheDocument();
  });

  it('shows the ID type and its masked number on the ID tab for a non-HOD viewer', () => {
    render(<VisitorDetails visit={withId} onClose={vi.fn()} viewerRole="admin" />);
    fireEvent.click(screen.getByRole('tab', { name: /id/i }));
    // The KIND of document, unmasked and on its own — it is not the number, and
    // it is the half being compared against what the visitor handed over.
    expect(screen.getByText('ID Proof Type')).toBeInTheDocument();
    expect(screen.getByText('Aadhaar')).toBeInTheDocument();
    expect(screen.getByText('Aadhaar ••••46')).toBeInTheDocument();
  });

  it('claims Identity verified only when a photo AND an ID are both on record', () => {
    render(<VisitorDetails visit={withId} onClose={vi.fn()} viewerRole="admin" />);
    fireEvent.click(screen.getByRole('tab', { name: /id/i }));
    // No photo on this fixture — a green tick here would be a claim about a
    // person that nothing in the record supports.
    expect(screen.queryByText('Identity verified')).not.toBeInTheDocument();
    expect(screen.getByText('Not verified at the gate')).toBeInTheDocument();

    cleanup();
    render(<VisitorDetails visit={{ ...withId, photo_url: 'blob:photo' } as unknown as Visit} onClose={vi.fn()} viewerRole="admin" />);
    fireEvent.click(screen.getByRole('tab', { name: /id/i }));
    expect(screen.getByText('Identity verified')).toBeInTheDocument();
  });
});
