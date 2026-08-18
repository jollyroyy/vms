// THE VISITOR IS PHOTOGRAPHED ONCE (client instruction, 2026-08-18: "the photo
// cannot be taken twice, it should not ask twice — once it has captured it, it
// should keep it").
//
// The case this pins is the walk-in. `WalkInRequest` uploads a face BEFORE the
// visit row exists, so the host never sees a request without one — and that
// visitor then reaches this step through the search desk, the Expected panel's
// Verify ID, or a scanned pass, every one of which pointed a camera at the same
// person a second time, minutes later, for a record the row already held.
//
// The approved-walk-in lane has refused to do that since 2026-08-17. This is
// the same rule on the other three ways into the same visit — a rule that holds
// on one lane and not the others is not a rule.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CheckInPhotoStep from '../../../src/pages/Guard/CheckInPhotoStep';
import type { MatchItem } from '../../../src/pages/Guard/CheckInPanel';

const mockUseCameraStream = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/useCameraStream', () => ({ useCameraStream: mockUseCameraStream }));
// The availability lookup is a different rule with its own test file; here it
// must simply never claim the card is taken.
vi.mock('../../../src/lib/useCardAvailability', () => ({
  useCardAvailability: () => ({ holder: null, checking: false }),
}));

const base: MatchItem = {
  id: 'pre:v1',
  source: 'pre_approved',
  visitorName: 'Rahul Verma',
  visitorPhone: '9876543210',
  departmentName: 'Information Technology',
  departmentId: 'd1',
  purpose: 'meeting',
  hostName: 'Priya Sharma',
  vendorName: 'Acme',
  approvalType: 'walk_in',
  approvedAt: '2026-08-18T08:00:00Z',
  scheduledFor: null,
  dueToday: true,
  status: 'walkin_approved',
  checkedInAt: null,
  checkedOutAt: null,
  visitId: 'v1',
};

const noop = () => {};
const props = {
  photoBlob: null,
  error: '',
  checkingIn: false,
  carrying: false,
  onCarryingChange: noop,
  remarks: '',
  onRemarksChange: noop,
  cardNumber: '',
  onCardNumberChange: noop,
  onBack: noop,
  onCapture: noop,
  onRetake: noop,
  onCancel: noop,
  onConfirm: noop,
  onScanResult: noop,
};

beforeEach(() => {
  mockUseCameraStream.mockReturnValue({ status: 'streaming', errorMessage: '', start: vi.fn(), stop: vi.fn() });
});
afterEach(cleanup);

describe('a visit that already carries a photo', () => {
  const withPhoto = { ...base, photoUrl: 'data:image/webp;base64,AAAA' };

  it('does not open the camera', () => {
    render(<CheckInPhotoStep {...props} selectedMatch={withPhoto} />);
    // PhotoCapture's own control. Its absence is the whole instruction.
    expect(screen.queryByRole('button', { name: /capture photo/i })).toBeNull();
    expect(document.querySelector('video')).toBeNull();
  });

  it('says what is on file rather than asserting nothing', () => {
    render(<CheckInPhotoStep {...props} selectedMatch={withPhoto} />);
    expect(screen.getByText(/photo already on file/i)).toBeTruthy();
  });

  // Offering one is asking twice with a politer label. The face on file is the
  // one the gate captured; this desk does not redo it.
  it('offers no way to replace it', () => {
    render(<CheckInPhotoStep {...props} selectedMatch={withPhoto} />);
    expect(screen.queryByRole('button', { name: /retake/i })).toBeNull();
  });

  // It goes straight to the rest of the check-in, so the card number and the
  // carrying declaration are still collected.
  it('reaches the confirm step', () => {
    render(<CheckInPhotoStep {...props} selectedMatch={withPhoto} />);
    expect(screen.getByRole('button', { name: /^check in$/i })).toBeTruthy();
    expect(screen.getByLabelText(/visitor card number/i)).toBeTruthy();
  });
});

describe('a visit that carries no photo', () => {
  // The pre-approval a host raised days before anybody pointed a camera at the
  // visitor. Nobody has taken one, so the camera opens exactly as before.
  it('still opens the camera', () => {
    render(<CheckInPhotoStep {...props} selectedMatch={base} />);
    expect(document.querySelector('video')).not.toBeNull();
    expect(screen.queryByText(/photo already on file/i)).toBeNull();
  });
});
