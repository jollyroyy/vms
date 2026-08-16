import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import GuardWalkInApproved from '../../../src/pages/Guard/GuardWalkInApproved';
import type { Visit } from '../../../src/types/index';

// The exit half of the walk-in desk.
//
// Since migration 080 the approver admits the visitor in the same click, so a
// walk-in never passes through this desk on the way IN — they are already
// `checked_in` by the time the guard looks. That left the lane holding rows the
// guard could see and not act on, and the only way to let one of those visitors
// out was to know that a different tab (Entry & Exit) owns the exit. The desk
// that shows a walk-in's whole life must be able to end it.
//
// The write is NOT duplicated: the parent opens the same CardReturnConfirm and
// calls the same lib/checkOutFlow.logVisitExit the Entry & Exit tab uses. This
// component only asks.

vi.mock('../../../src/components/PhotoCapture', () => ({
  default: ({ onCapture }: { onCapture: (blob: Blob) => void }) => (
    <button type="button" onClick={() => onCapture(new Blob(['photo'], { type: 'image/webp' }))}>
      Mock Capture
    </button>
  ),
}));

vi.mock('../../../src/pages/Guard/IdScanOverlay', () => ({
  default: () => <div>Mock Scanner</div>,
}));

afterEach(() => cleanup());

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    status: 'walkin_approved',
    created_at: '2026-08-16T04:00:00Z',
    checked_in_at: null,
    checked_out_at: null,
    photo_data: null,
    visitor: { full_name: 'Rahul Verma' } as any,
    department: { name: 'Engineering' } as any,
    ...overrides,
  } as unknown as Visit;
}

const admitted = (overrides: Partial<Visit> = {}) =>
  visit({ id: 'admitted', status: 'checked_in', checked_in_at: '2026-08-16T04:30:00Z', ...overrides });

const departed = () =>
  visit({
    id: 'departed',
    status: 'checked_out',
    checked_in_at: '2026-08-16T04:30:00Z',
    checked_out_at: '2026-08-16T06:30:00Z',
  });

function baseProps(overrides: Record<string, any> = {}) {
  return {
    loading: false,
    approved: [] as Visit[],
    busyId: null as string | null,
    onCheckIn: vi.fn(),
    onCheckOut: vi.fn(),
    ...overrides,
  };
}

describe('GuardWalkInApproved — letting an admitted walk-in out', () => {
  it('offers Check Out on a walk-in the approver admitted', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [admitted()] })} />);
    expect(screen.getByText('Already checked in (1)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check Out' })).toBeInTheDocument();
  });

  it('asks the parent to check that visitor out, naming the row that was clicked', () => {
    const onCheckOut = vi.fn();
    const v = admitted();
    render(<GuardWalkInApproved {...baseProps({ approved: [v], onCheckOut })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Check Out' }));

    expect(onCheckOut).toHaveBeenCalledTimes(1);
    expect(onCheckOut.mock.calls[0][0]).toBe(v);
  });

  // The rule the rest of the guard surface follows: a control the guard cannot
  // honour is worse than no control. This visitor has already left.
  it('offers no action on a walk-in who has already checked out', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [departed()] })} />);
    expect(screen.queryByRole('button', { name: 'Check Out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check In' })).not.toBeInTheDocument();
  });

  // A row still resting in `walkin_approved` (approved before 080 landed) is
  // the one kind that still needs the gate's check-in step, and it must not be
  // offered an exit — nobody has come in yet.
  it('offers Check In, and never Check Out, on a walk-in still waiting at the gate', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit()] })} />);
    expect(screen.getByText('Check In')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check Out' })).not.toBeInTheDocument();
  });

  it('separates the two groups: one waiting to enter, one able to leave', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit(), admitted(), departed()] })} />);
    expect(screen.getByText('Check In')).toBeInTheDocument();
    expect(screen.getByText('Already checked in (2)')).toBeInTheDocument();
    // Only the one still on site can be let out.
    expect(screen.getAllByRole('button', { name: 'Check Out' })).toHaveLength(1);
  });

  // The desk is read-only for a viewer with no exit handler wired in, rather
  // than rendering a button that resolves to nothing.
  it('renders no exit control when the parent supplies no handler', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [admitted()], onCheckOut: undefined })} />);
    expect(screen.queryByRole('button', { name: 'Check Out' })).not.toBeInTheDocument();
  });
});
