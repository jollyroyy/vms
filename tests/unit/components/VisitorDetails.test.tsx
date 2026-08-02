import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
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
  visitor: { full_name: 'John Doe', phone: '9999999999', company: 'Acme Corp', id_type: null, id_last4: null },
  department: { name: 'Engineering' },
  host: { full_name: 'Jane Smith' },
} as unknown as Visit;

afterEach(() => cleanup());

describe('VisitorDetails — closing the popup', () => {
  it('exposes the corner cross as an accessible "Close" button', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('calls onClose when the corner cross is clicked', () => {
    const onClose = vi.fn();
    render(<VisitorDetails visit={visit} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Regression guard: the profile card wrapper is a LATER sibling with z-10 and
  // is pulled up into the header with -mt-10, leaving only ~2px of clearance.
  // At equal z-index the later sibling wins, so any font/zoom variation made it
  // cover the cross and swallow the click. The cross must outrank it.
  it('stacks the close button above the overlapping profile card', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Close' }).className).toContain('z-30');
  });

  // The decorative radial-gradient fills the whole header, including the area
  // under the cross. It must never intercept pointer events.
  it('makes the decorative header gradient non-interactive', () => {
    const { container } = render(<VisitorDetails visit={visit} onClose={vi.fn()} />);
    const decorative = container.querySelector('[aria-hidden="true"]');
    expect(decorative).not.toBeNull();
    expect(decorative!.className).toContain('pointer-events-none');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<VisitorDetails visit={visit} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked but not when the panel is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<VisitorDetails visit={visit} onClose={onClose} />);
    fireEvent.click(container.querySelector('.modal-content')!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('.modal-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('VisitorDetails — timeline', () => {
  afterEach(() => cleanup());

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
});

describe('VisitorDetails — reopening the entry pass', () => {
  afterEach(() => cleanup());

  it('offers a View Pass toggle for a pre-approved visit', () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /view pass/i })).toBeInTheDocument();
  });

  it('reveals the QR pass on click and hides it again on a second click', async () => {
    render(<VisitorDetails visit={visit} onClose={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /view pass/i });

    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByAltText('Entry pass QR code')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /hide pass/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hide pass/i }));
    expect(screen.queryByAltText('Entry pass QR code')).not.toBeInTheDocument();
  });

  it('offers a pass for a walk-in approval so the badge can still be printed', () => {
    render(<VisitorDetails visit={{ ...visit, status: 'walkin_approved' }} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /view pass/i })).toBeInTheDocument();
  });

  // Previously the pass disappeared the moment the guard checked the visitor
  // in, which is precisely when a lost or unprinted badge needs reissuing.
  it('still offers the pass once the visitor has checked in', () => {
    render(<VisitorDetails visit={{ ...visit, status: 'checked_in', checked_in_at: '2026-07-30T09:30:00Z' }} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /view pass/i })).toBeInTheDocument();
  });

  it('does not offer a pass while the visit is still awaiting approval', () => {
    render(<VisitorDetails visit={{ ...visit, status: 'pending_approval' }} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /view pass/i })).not.toBeInTheDocument();
  });

  it('does not offer a pass once the visit has ended', () => {
    render(<VisitorDetails visit={{ ...visit, status: 'checked_out', checked_out_at: '2026-07-30T17:00:00Z' }} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /view pass/i })).not.toBeInTheDocument();
  });
});
