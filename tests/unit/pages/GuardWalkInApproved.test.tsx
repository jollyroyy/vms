import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import GuardWalkInApproved from '../../../src/pages/Guard/GuardWalkInApproved';
import { formatDateTime } from '../../../src/lib/formatDate';
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

// Same for the ID scanner: a button that fires onScanned with a canned result.
vi.mock('../../../src/pages/Guard/IdScanOverlay', () => ({
  default: ({ onScanned }: { onScanned: (r: any) => void }) => (
    <button type="button" onClick={() => onScanned({ idType: 'PAN', idLast4: '234F', name: 'Rahul Verma' })}>
      Mock Scan
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

// Opens the check-in panel and fills the mandatory fields (photo + card).
function openAndFillCard(value = 'C-104') {
  fireEvent.click(screen.getByText('Check In'));
  fireEvent.click(screen.getByText('Mock Capture'));
  fireEvent.change(screen.getByLabelText(/Visitor card number/i), { target: { value } });
}

describe('GuardWalkInApproved', () => {
  it('renders the "Awaiting gate check-in" heading and the count', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit(), visit({ id: 'v2' })] })} />);
    expect(screen.getByText('Awaiting gate check-in')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it("renders an approved walk-in's name", () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit()] })} />);
    expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
  });

  // The list is no longer today-only, so a bare "09:00" could not be told
  // from yesterday's 09:00 — the row must carry the date alongside the time.
  it("shows the approved walk-in's timestamp WITH its date, not time alone", () => {
    const v = visit({ created_at: '2026-08-04T04:00:00Z' });
    render(<GuardWalkInApproved {...baseProps({ approved: [v] })} />);
    expect(screen.getByText(formatDateTime(v.created_at))).toBeInTheDocument();
  });

  it('shows the empty state when there are no approved walk-ins and loading is false', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [], loading: false })} />);
    expect(screen.getByText('Nobody is waiting to be checked in.')).toBeInTheDocument();
  });

  it('clicking Check In opens the photo step', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit()] })} />);
    fireEvent.click(screen.getByText('Check In'));
    // The heading names WHICH camera this is. The ID scan and the visitor photo
    // are the same physical webcam on a laptop, so an unlabelled "take a photo"
    // read as the ID scan starting over.
    expect(screen.getByText('Photo of the visitor')).toBeInTheDocument();
    expect(screen.getByText(/not at the ID card/i)).toBeInTheDocument();
  });

  // The bug this flow exists to prevent: a check-in recorded with no photo.
  it('disables Confirm Check In until a photo AND a card number are present', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit()] })} />);
    fireEvent.click(screen.getByText('Check In'));

    const confirm = screen.getByText('Confirm Check In');
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByText('Mock Capture'));
    expect(confirm).toBeDisabled();
    expect(screen.getByText('Enter the card number before checking in.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Visitor card number/i), { target: { value: 'C-104' } });
    expect(confirm).not.toBeDisabled();
  });

  it('rejects a card number with characters outside the allowlist', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit()] })} />);
    fireEvent.click(screen.getByText('Check In'));
    fireEvent.click(screen.getByText('Mock Capture'));
    fireEvent.change(screen.getByLabelText(/Visitor card number/i), { target: { value: 'C 104' } });

    expect(screen.getByText('Confirm Check In')).toBeDisabled();
    expect(
      screen.getByText('Letters, digits and hyphens only — e.g. C-104.')
    ).toBeInTheDocument();
  });

  it('calls onCheckIn with the captured photo, card number and scan once confirmed', () => {
    const onCheckIn = vi.fn();
    const v = visit();
    render(<GuardWalkInApproved {...baseProps({ approved: [v], onCheckIn })} />);
    openAndFillCard();
    fireEvent.click(screen.getByText('Scan ID card'));
    fireEvent.click(screen.getByText('Mock Scan'));
    fireEvent.click(screen.getByText('Confirm Check In'));

    expect(onCheckIn).toHaveBeenCalledTimes(1);
    const [calledVisit, details] = onCheckIn.mock.calls[0];
    expect(calledVisit).toBe(v);
    expect(details.photoBlob).toBeInstanceOf(Blob);
    expect(details.cardNumber).toBe('C-104');
    expect(details.idScan).toEqual({ idType: 'PAN', idLast4: '234F', name: 'Rahul Verma' });
    expect(details.carrying).toBe(false);
    expect(details.remarks).toBe('');
  });

  it('flushes the captured photo and card after confirm', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit()] })} />);
    openAndFillCard();
    fireEvent.click(screen.getByText('Confirm Check In'));
    expect(screen.queryByText('Take a photo to check in')).not.toBeInTheDocument();
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