import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import CheckInPhotoStep from '../../../src/pages/Guard/CheckInPhotoStep';
import type { MatchItem } from '../../../src/pages/Guard/CheckInPanel';

// The visitor-card-number gate, isolated from scan and carrying behaviour —
// one behaviour per file per CLAUDE.md.
// The card-availability lookup (migration 102) is a separate rule with its own
// test file. Mocked free here so a debounced query never reaches the real
// supabase client mid-test — this file is about the ID scan.
vi.mock('../../../src/lib/useCardAvailability', () => ({
  useCardAvailability: () => ({ holder: null, checking: false }),
}));

vi.mock('../../../src/lib/useCameraStream', () => ({
  useCameraStream: () => ({ status: 'streaming', errorMessage: '', start: vi.fn(), stop: vi.fn() }),
}));

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

// The ID scan is mandatory on this step since 2026-08-17, so every test that
// wants to reach an ENABLED Check In has to satisfy it. The overlay is a camera
// and an OCR engine; here it is a stub that hands back one scanned identity.
// (What the scan itself does is CheckInPhotoStepScan.test.tsx's subject.)
vi.mock('../../../src/pages/Guard/IdScanOverlay', () => ({
  default: (props: any) => (
    <button onClick={() => props.onScanned({ idType: 'PAN', idLast4: '234F', name: 'Rahul Verma' })}>
      ID SCAN STUB
    </button>
  ),
}));

function completeScan(): void {
  fireEvent.click(screen.getByText('Scan ID card'));
  fireEvent.click(screen.getByText('ID SCAN STUB'));
}

beforeEach(() => {
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderStep(overrides: Record<string, any> = {}) {
  const props = {
    selectedMatch: match,
    photoBlob: new Blob(['photo'], { type: 'image/jpeg' }),
    error: '',
    checkingIn: false,
    carrying: false,
    onCarryingChange: vi.fn(),
    remarks: '',
    onRemarksChange: vi.fn(),
    cardNumber: '',
    onCardNumberChange: vi.fn(),
    onBack: vi.fn(),
    onCapture: vi.fn(),
    onRetake: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    onScanResult: vi.fn(),
    ...overrides,
  };
  render(<CheckInPhotoStep {...(props as any)} />);
  return props;
}

describe('CheckInPhotoStep — visitor card number', () => {
  it('renders the card field with a label naming the card', () => {
    renderStep();
    expect(screen.getByLabelText(/Visitor card number/i)).toBeInTheDocument();
  });

  it('reports keystrokes to the parent', () => {
    const props = renderStep();
    fireEvent.change(screen.getByLabelText(/Visitor card number/i), {
      target: { value: 'C-104' },
    });
    expect(props.onCardNumberChange).toHaveBeenCalledWith('C-104');
  });

  it('blocks check-in when no card number has been typed', () => {
    renderStep({ cardNumber: '' });
    expect(screen.getByText('Check In').closest('button')).toBeDisabled();
    expect(screen.getByText('Enter the card number before checking in.')).toBeInTheDocument();
  });

  it('allows check-in once a valid card number is present', () => {
    const props = renderStep({ cardNumber: 'C-104' });
    completeScan();
    const confirm = screen.getByText('Check In');
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(props.onConfirm).toHaveBeenCalled();
  });

  it('rejects a card number containing characters outside the allowlist', () => {
    renderStep({ cardNumber: 'C 104' });
    expect(screen.getByText('Check In').closest('button')).toBeDisabled();
    expect(
      screen.getByText('Letters, digits and hyphens only — e.g. C-104.')
    ).toBeInTheDocument();
  });

  it('rejects a card number that is only whitespace', () => {
    renderStep({ cardNumber: '   ' });
    expect(screen.getByText('Check In').closest('button')).toBeDisabled();
  });

  it('accepts an overlong card number only up to the input maxLength', () => {
    const props = renderStep();
    const input = screen.getByLabelText(/Visitor card number/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'A'.repeat(25) } });
    expect(props.onCardNumberChange).toHaveBeenCalledWith('A'.repeat(25));
    expect(input.maxLength).toBe(20);
  });

  it('accepts letters, digits and hyphens in any mix', () => {
    const props = renderStep({ cardNumber: 'V2-9C-D04' });
    completeScan();
    const confirm = screen.getByText('Check In');
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(props.onConfirm).toHaveBeenCalled();
  });
});