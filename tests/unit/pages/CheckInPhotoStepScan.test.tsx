import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import CheckInPhotoStep from '../../../src/pages/Guard/CheckInPhotoStep';
import type { MatchItem } from '../../../src/pages/Guard/CheckInPanel';

const mockUseCameraStream = vi.hoisted(() => vi.fn());
const mockGetEngine = vi.hoisted(() => vi.fn());
const mockRecognise = vi.hoisted(() => vi.fn());

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

const PAN_TEXT = [
  'INCOME TAX DEPARTMENT',
  'PERMANENT ACCOUNT NUMBER',
  'ABCDE1234F',
  'Name: Rahul Verma',
].join('\n');

beforeEach(() => {
  mockUseCameraStream.mockReturnValue({ status: 'streaming', errorMessage: '', start: vi.fn(), stop: vi.fn() });
  mockGetEngine.mockReturnValue({
    id: 'browser-wasm',
    ocr: vi.fn().mockResolvedValue({ recognise: mockRecognise }),
    face: vi.fn(),
  });
  mockRecognise.mockResolvedValue({ lines: [{ text: PAN_TEXT, confidence: 0.9 }], fullText: PAN_TEXT });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 1280 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 720 });
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['frame'], { type: 'image/jpeg' }));
  };
  HTMLCanvasElement.prototype.getContext = function () {
    return { drawImage: vi.fn() } as any;
  };
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const baseProps = {
  selectedMatch: match,
  photoBlob: null,
  error: '',
  checkingIn: false,
  cardNumber: 'C-104',
  onCardNumberChange: vi.fn(),
  onBack: vi.fn(),
  onCapture: vi.fn(),
  onRetake: vi.fn(),
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
  onScanResult: vi.fn(),
};

describe('M-AI-OCR-UI: CheckInPhotoStep scan + identity match', () => {
  it('shows the Scan ID card button', async () => {
    render(<CheckInPhotoStep {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText('Scan ID card')).toBeInTheDocument();
    });
  });

  // Same rule as the QR flag: scanning is UNCONDITIONAL (the flag was removed
  // 2026-08-13 — Vite inlines env at build time, so an off-state would ship a
  // permanently dead button). The env var must have no effect whatsoever.
  it('shows the Scan ID card button even when VITE_FEATURE_OCR is "false"', async () => {
    vi.stubEnv('VITE_FEATURE_OCR', 'false');
    render(<CheckInPhotoStep {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText('Scan ID card')).toBeInTheDocument();
    });
  });

  it('reports identity verified when the scanned name matches the approved visitor', async () => {
    const onScanResult = vi.fn();
    render(<CheckInPhotoStep {...baseProps} photoBlob={new Blob(['x'], { type: 'image/webp' })} onScanResult={onScanResult} />);
    fireEvent.click(await screen.findByText('Scan ID card'));
    fireEvent.click(await screen.findByText('Capture Card'));
    fireEvent.click(await screen.findByText('Use Details'));
    await waitFor(() => {
      expect(screen.getByText('Identity verified')).toBeInTheDocument();
    });
    expect(onScanResult).toHaveBeenCalledWith({ idType: 'PAN', idLast4: '234F', name: 'Rahul Verma' });
    const checkInButton = screen.getByText('Check In');
    expect(checkInButton.closest('button')).not.toBeDisabled();
  });

  it('flags a mismatch and disables check-in when the scanned name differs', async () => {
    mockRecognise.mockResolvedValue({
      lines: [{ text: ['INCOME TAX DEPARTMENT', 'PERMANENT ACCOUNT NUMBER', 'ABCDE1234F', 'Name: Suresh Patel'].join('\n'), confidence: 0.9 }],
      fullText: ['INCOME TAX DEPARTMENT', 'PERMANENT ACCOUNT NUMBER', 'ABCDE1234F', 'Name: Suresh Patel'].join('\n'),
    });
    render(<CheckInPhotoStep {...baseProps} photoBlob={new Blob(['x'], { type: 'image/webp' })} />);
    fireEvent.click(await screen.findByText('Scan ID card'));
    fireEvent.click(await screen.findByText('Capture Card'));
    fireEvent.click(await screen.findByText('Use Details'));
    await waitFor(() => {
      expect(screen.getByText(/doesn.t match the approved visitor/i)).toBeInTheDocument();
    });
    const checkInButton = screen.getByText('Check In');
    expect(checkInButton.closest('button')).toBeDisabled();
  });

  it('discarding the scan clears the mismatch and re-enables check-in', async () => {
    mockRecognise.mockResolvedValue({
      lines: [{ text: ['INCOME TAX DEPARTMENT', 'PERMANENT ACCOUNT NUMBER', 'ABCDE1234F', 'Name: Suresh Patel'].join('\n'), confidence: 0.9 }],
      fullText: ['INCOME TAX DEPARTMENT', 'PERMANENT ACCOUNT NUMBER', 'ABCDE1234F', 'Name: Suresh Patel'].join('\n'),
    });
    const onScanResult = vi.fn();
    render(<CheckInPhotoStep {...baseProps} photoBlob={new Blob(['x'], { type: 'image/webp' })} onScanResult={onScanResult} />);
    fireEvent.click(await screen.findByText('Scan ID card'));
    fireEvent.click(await screen.findByText('Capture Card'));
    fireEvent.click(await screen.findByText('Use Details'));
    await waitFor(() => {
      expect(screen.getByText(/doesn.t match the approved visitor/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Discard scan'));
    await waitFor(() => {
      expect(screen.queryByText(/doesn.t match the approved visitor/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText('Check In').closest('button')).not.toBeDisabled();
    expect(onScanResult).toHaveBeenCalledWith(null);
  });

  it('records an ID whose name could not be read without blocking check-in', async () => {
    mockRecognise.mockResolvedValue({
      lines: [{ text: ['INCOME TAX DEPARTMENT', 'PERMANENT ACCOUNT NUMBER', 'ABCDE1234F'].join('\n'), confidence: 0.9 }],
      fullText: ['INCOME TAX DEPARTMENT', 'PERMANENT ACCOUNT NUMBER', 'ABCDE1234F'].join('\n'),
    });
    render(<CheckInPhotoStep {...baseProps} photoBlob={new Blob(['x'], { type: 'image/webp' })} />);
    fireEvent.click(await screen.findByText('Scan ID card'));
    fireEvent.click(await screen.findByText('Capture Card'));
    fireEvent.click(await screen.findByText('Use Details'));
    await waitFor(() => {
      expect(screen.getByText(/no name could be read/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Check In').closest('button')).not.toBeDisabled();
  });

  it('closes the overlay without applying anything', async () => {
    render(<CheckInPhotoStep {...baseProps} />);
    fireEvent.click(await screen.findByText('Scan ID card'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByText('Capture Card')).not.toBeInTheDocument();
    });
  });

  // The two-camera regression: autoScan (the dashboard's Verify ID) mounted
  // PhotoCapture BEHIND the scan overlay, so two getUserMedia streams ran at
  // once — the photo camera showed through the translucent backdrop as a
  // second OCR page, and on phones the scan camera often failed to start at
  // all. Exactly one camera may be live at any moment: while the overlay is
  // open there is no photo camera, and it mounts only after the overlay goes.
  it('mounts no photo camera while the scan overlay is open (one camera at a time)', async () => {
    render(<CheckInPhotoStep {...baseProps} autoScan />);
    expect(await screen.findByText('Capture Card')).toBeInTheDocument();
    expect(screen.queryByText('Capture Photo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.getByText('Capture Photo')).toBeInTheDocument();
    });
    expect(screen.queryByText('Capture Card')).not.toBeInTheDocument();
  });
});
