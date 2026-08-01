// Covers CheckInScanGate: the QR-scan toggle wrapper around GuardQRScan. The
// flag-off case is the most important test here — it guarantees the existing
// manual check-in flow renders byte-for-byte the same (nothing at all from
// this component) while the 'qr' feature flag is disabled.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const { mockIsEnabled } = vi.hoisted(() => ({
  mockIsEnabled: vi.fn(),
}));

vi.mock('../../../src/lib/featureFlags', () => ({ isFeatureEnabled: mockIsEnabled }));

const STUB_VISIT = { id: 'v-1', status: 'approved' };

vi.mock('../../../src/pages/Guard/GuardQRScan', () => ({
  default: (props: any) => (
    <div>
      <p>QR SCANNER STUB</p>
      <button onClick={() => props.onResolved(STUB_VISIT)}>Resolve Stub Visit</button>
      <button onClick={() => props.onCancel()}>Cancel Stub Scan</button>
    </div>
  ),
}));

import CheckInScanGate from '../../../src/pages/Guard/CheckInScanGate';

describe('S-QR-GATE: CheckInScanGate', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mockIsEnabled.mockReset();
  });

  it('renders nothing at all when the qr flag is off', () => {
    mockIsEnabled.mockReturnValue(false);
    const { container } = render(<CheckInScanGate onResolved={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: /scan qr/i })).not.toBeInTheDocument();
  });

  it('renders the Scan QR button when the flag is on', () => {
    mockIsEnabled.mockReturnValue(true);
    render(<CheckInScanGate onResolved={vi.fn()} />);
    expect(screen.getByRole('button', { name: /scan qr/i })).toBeInTheDocument();
  });

  it('mounts the scanner when Scan QR is clicked', () => {
    mockIsEnabled.mockReturnValue(true);
    render(<CheckInScanGate onResolved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /scan qr/i }));
    expect(screen.getByText('QR SCANNER STUB')).toBeInTheDocument();
  });

  it('bubbles the resolved visit up to the parent and leaves scan mode', () => {
    mockIsEnabled.mockReturnValue(true);
    const onResolved = vi.fn();
    render(<CheckInScanGate onResolved={onResolved} />);
    fireEvent.click(screen.getByRole('button', { name: /scan qr/i }));
    fireEvent.click(screen.getByRole('button', { name: /resolve stub visit/i }));
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledWith(STUB_VISIT);
    expect(screen.queryByText('QR SCANNER STUB')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan qr/i })).toBeInTheDocument();
  });

  it('returns to the button on cancel without calling onResolved', () => {
    mockIsEnabled.mockReturnValue(true);
    const onResolved = vi.fn();
    render(<CheckInScanGate onResolved={onResolved} />);
    fireEvent.click(screen.getByRole('button', { name: /scan qr/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel stub scan/i }));
    expect(onResolved).not.toHaveBeenCalled();
    expect(screen.queryByText('QR SCANNER STUB')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan qr/i })).toBeInTheDocument();
  });
});
