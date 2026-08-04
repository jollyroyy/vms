import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import GuardWalkInApproved from '../../../src/pages/Guard/GuardWalkInApproved';
import type { Visit } from '../../../src/types/index';

// jsdom has no camera. Stub PhotoCapture with a button that fires onCapture
// with a real Blob, mirroring the "user took a photo" moment.
vi.mock('../../../src/components/PhotoCapture', () => ({
  default: ({ onCapture }: { onCapture: (blob: Blob) => void }) => (
    <button type="button" onClick={() => onCapture(new Blob(['photo'], { type: 'image/webp' }))}>
      Mock Capture
    </button>
  ),
}));

afterEach(() => cleanup());

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    status: 'walkin_approved',
    created_at: '2026-08-04T04:00:00Z',
    checked_in_at: null,
    checked_out_at: null,
    photo_data: null,
    visitor: { full_name: 'Rahul Verma' } as any,
    department: { name: 'Engineering' } as any,
    ...overrides,
  } as unknown as Visit;
}

function baseProps(overrides: Record<string, any> = {}) {
  return {
    loading: false,
    approved: [] as Visit[],
    busyId: null as string | null,
    onCheckIn: vi.fn(),
    ...overrides,
  };
}

describe('GuardWalkInApproved', () => {
  it('renders the "Approved, waiting to enter" heading and the count', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit(), visit({ id: 'v2' })] })} />);
    expect(screen.getByText('Approved, waiting to enter')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it("renders an approved walk-in's name", () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit()] })} />);
    expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
  });

  it('shows the empty state when there are no approved walk-ins and loading is false', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [], loading: false })} />);
    expect(screen.getByText('No approved walk-ins waiting.')).toBeInTheDocument();
  });

  it('clicking Check In opens the photo step', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit()] })} />);
    fireEvent.click(screen.getByText('Check In'));
    expect(screen.getByText('Take a photo to check in')).toBeInTheDocument();
  });

  // The bug this flow exists to prevent: a check-in recorded with no photo.
  it('disables Confirm Check In until a photo has been captured', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit()] })} />);
    fireEvent.click(screen.getByText('Check In'));

    const confirm = screen.getByText('Confirm Check In');
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByText('Mock Capture'));
    expect(confirm).not.toBeDisabled();
  });

  it('calls onCheckIn with the captured photo once confirmed', () => {
    const onCheckIn = vi.fn();
    const v = visit();
    render(<GuardWalkInApproved {...baseProps({ approved: [v], onCheckIn })} />);
    fireEvent.click(screen.getByText('Check In'));
    fireEvent.click(screen.getByText('Mock Capture'));
    fireEvent.click(screen.getByText('Confirm Check In'));

    expect(onCheckIn).toHaveBeenCalledTimes(1);
    const [calledVisit, details] = onCheckIn.mock.calls[0];
    expect(calledVisit).toBe(v);
    expect(details.photoBlob).toBeInstanceOf(Blob);
    expect(details.carrying).toBe(false);
    expect(details.remarks).toBe('');
  });

  // Mirrors the documented carrying_material rule: the box gates the textarea,
  // and unticking it discards whatever was typed rather than leaving an
  // orphaned description on a visit flagged as carrying nothing.
  it('the carrying checkbox gates the remarks textarea and clears typed remarks on untick', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit()] })} />);
    fireEvent.click(screen.getByText('Check In'));

    expect(screen.queryByPlaceholderText('What are they carrying?')).not.toBeInTheDocument();

    const checkbox = screen.getByLabelText('Carrying material') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    const textarea = screen.getByPlaceholderText('What are they carrying?') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '1 laptop bag' } });
    expect(textarea).toHaveValue('1 laptop bag');

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(screen.queryByPlaceholderText('What are they carrying?')).not.toBeInTheDocument();

    // Re-tick: the textarea comes back empty, proving the text was discarded.
    fireEvent.click(checkbox);
    expect(screen.getByPlaceholderText('What are they carrying?')).toHaveValue('');
  });
});
