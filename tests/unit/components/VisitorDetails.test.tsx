import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import VisitorDetails from '../../../src/components/VisitorDetails';
import type { Visit } from '../../../src/types/index';

vi.mock('../../../src/lib/formatDate', () => ({
  formatDateTime: () => '30 Jul 2026, 10:00 AM',
  formatDuration: () => ({ text: '30m', isOvertime: false }),
}));

const visit = {
  id: 'v1',
  ref_number: 'VIS-20260730-0001',
  status: 'approved',
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
