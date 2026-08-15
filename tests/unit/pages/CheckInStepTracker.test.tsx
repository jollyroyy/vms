import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import CheckInStepTracker from '../../../src/pages/Guard/CheckInStepTracker';
import CheckInPhotoStep from '../../../src/pages/Guard/CheckInPhotoStep';
import type { MatchItem } from '../../../src/pages/Guard/CheckInPanel';

/**
 * "Why is it showing me the camera again?" — because the ID scan closing is
 * immediately followed by the visitor's face photo, on what is the same
 * physical webcam on a laptop. The flow is right; it was unlabelled. These
 * tests hold the labelling in place.
 */
const mockUseCameraStream = vi.hoisted(() => vi.fn());
const mockGetEngine = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/useCameraStream', () => ({ useCameraStream: mockUseCameraStream }));
vi.mock('../../../src/lib/ai/engine', () => ({ getEngine: mockGetEngine }));

const match: MatchItem = {
  id: 'pre:v1',
  source: 'pre_approved',
  visitorName: 'Rahul Verma',
  visitorPhone: '9876543210',
  departmentName: 'Information Technology',
  purpose: 'meeting',
  hostName: 'Priya Sharma',
  vendorName: 'Acme',
  approvalType: 'pre_approved',
  approvedAt: '2026-08-01T08:00:00Z',
  scheduledFor: null,
  visitId: 'v1',
};

const baseProps = {
  selectedMatch: match,
  photoBlob: null,
  error: '',
  checkingIn: false,
  carrying: false,
  onCarryingChange: vi.fn(),
  remarks: '',
  onRemarksChange: vi.fn(),
  cardNumber: 'C-104',
  onCardNumberChange: vi.fn(),
  onBack: vi.fn(),
  onCapture: vi.fn(),
  onRetake: vi.fn(),
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
  onScanResult: vi.fn(),
};

beforeEach(() => {
  mockUseCameraStream.mockReturnValue({ status: 'streaming', errorMessage: '', start: vi.fn(), stop: vi.fn() });
  mockGetEngine.mockReturnValue({ id: 'browser-wasm', ocr: vi.fn(), face: vi.fn() });
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CheckInStepTracker', () => {
  it('names all three stages', () => {
    render(<CheckInStepTracker scanned={false} photoTaken={false} cardDone={false} />);
    const list = screen.getByRole('list', { name: /check-in steps/i });
    expect(within(list).getByText('Scan ID')).toBeInTheDocument();
    expect(within(list).getByText('Photo')).toBeInTheDocument();
    expect(within(list).getByText('Card')).toBeInTheDocument();
  });

  // The scan does not gate Check In — only a mismatch and a bad card number do.
  // Presenting it as a required pending step would claim a rule the code does
  // not enforce.
  it('marks the ID scan optional until one has been accepted, never pending', () => {
    const { rerender } = render(<CheckInStepTracker scanned={false} photoTaken={false} cardDone={false} />);
    expect(screen.getByText(/\(optional\)/i)).toBeInTheDocument();

    rerender(<CheckInStepTracker scanned photoTaken={false} cardDone={false} />);
    expect(screen.queryByText(/\(optional\)/i)).toBeNull();
  });

  it('points at the photo before it is taken, and at the card after', () => {
    const { rerender } = render(<CheckInStepTracker scanned photoTaken={false} cardDone={false} />);
    expect(screen.getByText('Photo')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Card')).not.toHaveAttribute('aria-current');

    rerender(<CheckInStepTracker scanned photoTaken cardDone={false} />);
    expect(screen.getByText('Card')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Photo')).not.toHaveAttribute('aria-current');
  });
});

describe('CheckInPhotoStep — the second camera says it is the visitor, not the ID', () => {
  it('labels the photo camera as the visitor and warns off the ID card', () => {
    render(<CheckInPhotoStep {...baseProps} />);
    expect(screen.getByText(/Step 2 — Photo of the visitor/i)).toBeInTheDocument();
    expect(screen.getByText(/not at the ID card/i)).toBeInTheDocument();
  });

  it('shows the step tracker on both the photo screen and the confirm screen', () => {
    const { rerender } = render(<CheckInPhotoStep {...baseProps} />);
    expect(screen.getByRole('list', { name: /check-in steps/i })).toBeInTheDocument();

    rerender(<CheckInPhotoStep {...baseProps} photoBlob={new Blob(['x'], { type: 'image/webp' })} />);
    expect(screen.getByRole('list', { name: /check-in steps/i })).toBeInTheDocument();
  });

  // The old copy was "Take a photo to check in" — true, but it never said the
  // camera had changed subject, which is the whole reason it read as the scan
  // repeating.
  it('no longer uses the unlabelled photo heading', () => {
    render(<CheckInPhotoStep {...baseProps} />);
    expect(screen.queryByText('Take a photo to check in')).toBeNull();
  });
});
