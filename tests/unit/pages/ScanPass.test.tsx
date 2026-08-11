import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import ScanPass from '../../../src/pages/Guard/ScanPass';
import type { Visit } from '../../../src/types/index';

const { mockCheckInScannedVisit, mockIsEnabled } = vi.hoisted(() => ({
  mockCheckInScannedVisit: vi.fn(),
  mockIsEnabled: vi.fn(),
}));

vi.mock('../../../src/lib/featureFlags', () => ({ isFeatureEnabled: mockIsEnabled }));
vi.mock('../../../src/lib/checkInFlow', () => ({ checkInScannedVisit: mockCheckInScannedVisit }));
vi.mock('../../../src/lib/hostNames', () => ({ attachHostNames: (rows: any[]) => Promise.resolve(rows) }));

// The row a decoded QR resolves to. The real GuardQRScan hands the visit up
// through onResolved; this stub hands the same shape to the page under test.
const scannedVisit = {
  id: 'v1',
  ref_number: 'VIS-20260811-0001',
  visitor_id: 'vis1',
  department_id: 'dept1',
  host_id: 'h1',
  purpose: 'meeting',
  photo_path: null,
  photo_data: null,
  status: 'approved',
  checked_in_at: null,
  checked_out_at: null,
  exit_verified: null,
  rejection_reason: null,
  carrying_material: false,
  scheduled_for: '2026-08-11T09:00:00Z',
  qr_token: 'qr-token-1',
  qr_expires_at: '2026-08-11T18:30:00Z',
  created_at: '2026-08-10T04:00:00Z',
  visitor: {
    id: 'vis1', phone: '9876543210', full_name: 'Alice Johnson', vendor_name: 'Acme Corp',
    id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false,
    blacklist_reason: null, created_at: '2026-01-01T00:00:00Z',
  },
  department: { id: 'dept1', name: 'Engineering', code: 'ENG', created_at: '2026-01-01T00:00:00Z' },
  host: { id: 'h1', full_name: 'Jane Smith' },
} as Visit;

// No real camera: the scanner is a tiny stub whose test button resolves the
// fixture above, exactly like CheckInScanGate.test.tsx stubs GuardQRScan.
vi.mock('../../../src/pages/Guard/GuardQRScan', () => ({
  default: (props: any) => (
    <div>
      <p>QR SCANNER STUB</p>
      <button onClick={() => props.onResolved(scannedVisit)}>scan-resolved</button>
    </div>
  ),
}));

// PhotoCapture is a camera control; the photo step only needs a blob to move on.
vi.mock('../../../src/components/PhotoCapture', () => ({
  default: (props: any) => (
    <button onClick={() => props.onCapture(new Blob(['v'], { type: 'image/webp' }))}>
      PHOTO CAPTURE STUB
    </button>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/guard/scan-pass']}>
      <LocationProbe />
      <ScanPass />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockIsEnabled.mockReset();
  mockCheckInScannedVisit.mockReset();
  mockCheckInScannedVisit.mockResolvedValue({ ok: true, visitorName: 'Alice Johnson' });
  mockIsEnabled.mockReturnValue(true);
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('S-SCAN-PASS: ScanPass', () => {
  it('renders the Scan Pass heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /scan pass/i })).toBeInTheDocument();
  });

  it('renders the QR scanner until a pass is resolved', () => {
    renderPage();
    expect(screen.getByText('QR SCANNER STUB')).toBeInTheDocument();
  });

  it('shows the visitor summary once a scan resolves', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'scan-resolved' }));
    expect(await screen.findByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.queryByText('QR SCANNER STUB')).not.toBeInTheDocument();
  });

  it('checks in a scanned visitor once a photo is captured', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'scan-resolved' }));
    fireEvent.click(await screen.findByText('PHOTO CAPTURE STUB'));
    fireEvent.click(await screen.findByRole('button', { name: /check in/i }));

    await waitFor(() => {
      expect(mockCheckInScannedVisit).toHaveBeenCalledWith(expect.objectContaining({
        match: expect.objectContaining({ visitorName: 'Alice Johnson' }),
        photoBlob: expect.any(Blob),
      }));
    });
    expect(await screen.findByText(/checked in successfully/i)).toBeInTheDocument();
    expect(screen.getByText('QR SCANNER STUB')).toBeInTheDocument();
  });

  it('keeps the photo step and shows the reason when the check-in is blocked', async () => {
    mockCheckInScannedVisit.mockResolvedValue({ ok: false, message: 'blocked' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'scan-resolved' }));
    fireEvent.click(await screen.findByText('PHOTO CAPTURE STUB'));
    fireEvent.click(await screen.findByRole('button', { name: /check in/i }));

    expect(await screen.findByText('blocked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check in/i })).toBeInTheDocument();
  });

  it('shows the unavailable state and a route to pre-approvals when the qr flag is off', async () => {
    mockIsEnabled.mockReturnValue(false);
    renderPage();
    expect(screen.getByText(/scanning is unavailable/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open pre-approvals/i }));
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/guard/pre-approvals');
    });
  });
});