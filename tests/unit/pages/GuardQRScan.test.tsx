import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';

const { mockLookup, mockUseQrScanner, decodeRef } = vi.hoisted(() => ({
  mockLookup: vi.fn(),
  mockUseQrScanner: vi.fn(),
  decodeRef: { current: null as null | ((raw: string) => void) },
}));

vi.mock('../../../src/lib/qrLookup', () => ({ lookupVisitByQr: mockLookup }));
vi.mock('../../../src/lib/useQrScanner', () => ({ useQrScanner: mockUseQrScanner }));

import GuardQRScan from '../../../src/pages/Guard/GuardQRScan';

const PAYLOAD = 'vms://checkin/8f14e45f-ceea-467a-9a4e-3b1c2d5f6a7b';

const visit = {
  id: 'v1',
  ref_number: 'VMS-2026-0001',
  status: 'approved',
  visitor: { full_name: 'Asha Rao', phone: '9876543210' },
  department: { name: 'Finance' },
};

/** Fires the decode callback the component handed to the scanner hook. */
function scan(raw = PAYLOAD) {
  if (!decodeRef.current) throw new Error('component never registered a decode handler');
  act(() => { decodeRef.current!(raw); });
}

describe('S-QR-SCAN: GuardQRScan', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mockLookup.mockReset();
    mockUseQrScanner.mockReset();
    decodeRef.current = null;
    mockUseQrScanner.mockImplementation((opts: any) => {
      decodeRef.current = opts.onDecode;
      return { state: 'scanning' };
    });
  });

  it('renders the scanner heading and instruction', () => {
    render(<GuardQRScan onResolved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /scan qr/i })).toBeInTheDocument();
    expect(screen.getByText(/hold the visitor's qr code/i)).toBeInTheDocument();
  });

  it('always offers a manual-search escape hatch', () => {
    const onCancel = vi.fn();
    render(<GuardQRScan onResolved={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByRole('button', { name: /search manually/i })).toBeInTheDocument();
  });

  it('returns to manual search when the guard backs out', async () => {
    const onCancel = vi.fn();
    render(<GuardQRScan onResolved={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /search manually/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('hands a valid, open-gate visit up to the parent', async () => {
    mockLookup.mockResolvedValue({ status: 'found', visit, gate: { ok: true, reason: null } });
    const onResolved = vi.fn();
    render(<GuardQRScan onResolved={onResolved} onCancel={vi.fn()} />);
    scan();
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1' })));
  });

  it('shows the blocking reason and does NOT proceed when the gate is closed', async () => {
    mockLookup.mockResolvedValue({
      status: 'found',
      visit,
      gate: { ok: false, reason: 'This visitor is already checked in.' },
    });
    const onResolved = vi.fn();
    render(<GuardQRScan onResolved={onResolved} onCancel={vi.fn()} />);
    scan();
    expect(await screen.findByText(/already checked in/i)).toBeInTheDocument();
    expect(onResolved).not.toHaveBeenCalled();
  });

  it('names the visitor on a blocked scan so the guard knows who was rejected', async () => {
    mockLookup.mockResolvedValue({
      status: 'found',
      visit,
      gate: { ok: false, reason: 'This QR code has expired.' },
    });
    render(<GuardQRScan onResolved={vi.fn()} onCancel={vi.fn()} />);
    scan();
    expect(await screen.findByText(/Asha Rao/)).toBeInTheDocument();
  });

  it('reports an unrecognised code', async () => {
    mockLookup.mockResolvedValue({ status: 'invalid' });
    render(<GuardQRScan onResolved={vi.fn()} onCancel={vi.fn()} />);
    scan('https://example.com');
    expect(await screen.findByText(/not a visitor pass/i)).toBeInTheDocument();
  });

  it('reports a code with no matching visit', async () => {
    mockLookup.mockResolvedValue({ status: 'not_found' });
    render(<GuardQRScan onResolved={vi.fn()} onCancel={vi.fn()} />);
    scan();
    expect(await screen.findByText(/no visit matches/i)).toBeInTheDocument();
  });

  it('surfaces a lookup failure without crashing', async () => {
    mockLookup.mockResolvedValue({ status: 'error', message: 'network down' });
    render(<GuardQRScan onResolved={vi.fn()} onCancel={vi.fn()} />);
    scan();
    expect(await screen.findByText(/network down/i)).toBeInTheDocument();
  });

  it('lets the guard retry after a failed scan', async () => {
    mockLookup.mockResolvedValue({ status: 'not_found' });
    render(<GuardQRScan onResolved={vi.fn()} onCancel={vi.fn()} />);
    scan();
    const retry = await screen.findByRole('button', { name: /scan again/i });
    mockLookup.mockResolvedValue({ status: 'found', visit, gate: { ok: true, reason: null } });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByText(/no visit matches/i)).not.toBeInTheDocument());
  });

  it('ignores further decodes while a lookup is already in flight', async () => {
    mockLookup.mockReturnValue(new Promise(() => {})); // never settles
    render(<GuardQRScan onResolved={vi.fn()} onCancel={vi.fn()} />);
    scan();
    scan();
    scan();
    await waitFor(() => expect(mockLookup).toHaveBeenCalledTimes(1));
  });

  it('falls back to manual search when no camera is available', () => {
    mockUseQrScanner.mockImplementation(() => ({ state: 'unavailable' }));
    render(<GuardQRScan onResolved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/camera (is )?unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search manually/i })).toBeInTheDocument();
  });

  it('shows a starting state while the camera warms up', () => {
    mockUseQrScanner.mockImplementation(() => ({ state: 'starting' }));
    render(<GuardQRScan onResolved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/starting camera/i)).toBeInTheDocument();
  });
});
