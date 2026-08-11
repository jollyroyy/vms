// Covers CheckInScanGate: the QR-scan toggle wrapper around GuardQRScan.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

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

  // The 'qr' feature flag was removed: Vite inlines env vars at build time and
  // .env is git-ignored, so VITE_FEATURE_QR was permanently false in every
  // deployed build and the scan entry point never appeared for any guard.
  // There is no flag left to check here — this button must always be there.
  it('always offers the scan entry point — there is no feature flag to switch it off', () => {
    render(<CheckInScanGate onResolved={vi.fn()} />);
    expect(screen.getByRole('button', { name: /scan qr/i })).toBeInTheDocument();
  });

  it('mounts the scanner when Scan QR is clicked', () => {
    render(<CheckInScanGate onResolved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /scan qr/i }));
    expect(screen.getByText('QR SCANNER STUB')).toBeInTheDocument();
  });

  it('bubbles the resolved visit up to the parent and leaves scan mode', () => {
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
    const onResolved = vi.fn();
    render(<CheckInScanGate onResolved={onResolved} />);
    fireEvent.click(screen.getByRole('button', { name: /scan qr/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel stub scan/i }));
    expect(onResolved).not.toHaveBeenCalled();
    expect(screen.queryByText('QR SCANNER STUB')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan qr/i })).toBeInTheDocument();
  });
});
