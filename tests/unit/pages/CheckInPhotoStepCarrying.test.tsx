import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import CheckInPhotoStep from '../../../src/pages/Guard/CheckInPhotoStep';
import type { MatchItem } from '../../../src/pages/Guard/CheckInPanel';

// The carrying-material control, isolated from the OCR/scan behaviour that
// CheckInPhotoStepScan.test.tsx covers. Split per CLAUDE.md: one behaviour per
// test file, each with its own harness.
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

beforeEach(() => {
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// The control only exists on the confirm step, which is reached once a photo
// has been captured — hence a non-null photoBlob on every render here.
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
    // A valid card by default so the carrying tests exercise the carrying
    // control, not the card gate (card behaviour has its own file).
    cardNumber: 'C-104',
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

describe('CheckInPhotoStep — carrying material', () => {
  it('renders an unticked checkbox beside the remarks area', () => {
    renderStep();
    const box = screen.getByLabelText(/Carrying material/i) as HTMLInputElement;
    expect(box).toBeInTheDocument();
    expect(box.type).toBe('checkbox');
    expect(box.checked).toBe(false);
  });

  // The whole point of the tick box: the flag is an explicit answer, not an
  // inference from whether the guard happened to type something.
  it('hides the remarks textarea until the box is ticked', () => {
    renderStep({ carrying: false });
    expect(screen.queryByLabelText(/What are they carrying/i)).not.toBeInTheDocument();
  });

  it('shows the remarks textarea once the box is ticked', () => {
    renderStep({ carrying: true });
    expect(screen.getByLabelText(/What are they carrying/i)).toBeInTheDocument();
  });

  it('ticking the box reports true to the parent', () => {
    const props = renderStep({ carrying: false });
    fireEvent.click(screen.getByLabelText(/Carrying material/i));
    expect(props.onCarryingChange).toHaveBeenCalledWith(true);
  });

  it('unticking the box reports false to the parent', () => {
    const props = renderStep({ carrying: true });
    fireEvent.click(screen.getByLabelText(/Carrying material/i));
    expect(props.onCarryingChange).toHaveBeenCalledWith(false);
  });

  it('typing in the remarks area reports the text to the parent', () => {
    const props = renderStep({ carrying: true });
    fireEvent.change(screen.getByLabelText(/What are they carrying/i), {
      target: { value: '1 Dell laptop' },
    });
    expect(props.onRemarksChange).toHaveBeenCalledWith('1 Dell laptop');
  });

  it('keeps existing remarks visible when the box is already ticked', () => {
    renderStep({ carrying: true, remarks: '2 Samsung phones' });
    expect(screen.getByLabelText(/What are they carrying/i)).toHaveValue('2 Samsung phones');
  });

  it('does not block check-in — carrying material is optional', () => {
    const props = renderStep({ carrying: false });
    const confirm = screen.getByText('Check In');
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(props.onConfirm).toHaveBeenCalled();
  });
});
