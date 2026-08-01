import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import VisitorForm from '../../../src/pages/Guard/VisitorForm';

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockUseCameraStream = vi.hoisted(() => vi.fn());
const mockGetEngine = vi.hoisted(() => vi.fn());
const mockRecognise = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
  },
}));
vi.mock('../../../src/lib/useCameraStream', () => ({ useCameraStream: mockUseCameraStream }));
vi.mock('../../../src/lib/ai/engine', () => ({ getEngine: mockGetEngine }));

const mockDepts = [
  { id: 'dept-it', name: 'Information Technology', code: 'IT', created_at: '2026-01-01' },
];
const mockHosts = [
  { id: 'h1', full_name: 'Priya Sharma', email: 'hod.it@demo.vms', role: 'hod' },
];

const PAN_TEXT = [
  'INCOME TAX DEPARTMENT',
  'PERMANENT ACCOUNT NUMBER',
  'ABCDE1234F',
  'Name: Rahul Verma',
].join('\n');

beforeEach(() => {
  vi.stubEnv('VITE_FEATURE_OCR', 'true');
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
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'departments') {
      return { select: () => ({ order: vi.fn().mockResolvedValue({ data: mockDepts, error: null }) }) };
    }
    if (table === 'visitors') {
      return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    }
    return { select: () => ({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) };
  });
  mockRpc.mockImplementation((name: string) => {
    if (name === 'get_hosts_for_department') return Promise.resolve({ data: mockHosts, error: null });
    if (name === 'get_active_visit_for_phone') return Promise.resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('M-AI-OCR-UI: VisitorForm scan wiring', () => {
  it('shows the Scan ID card button when the OCR flag is on', async () => {
    render(<VisitorForm onRegistered={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Scan ID card')).toBeInTheDocument();
    });
  });

  it('hides the Scan ID card button when the OCR flag is off', async () => {
    vi.stubEnv('VITE_FEATURE_OCR', 'false');
    render(<VisitorForm onRegistered={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByText('Scan ID card')).not.toBeInTheDocument();
    });
  });

  it('opens the overlay, scans, and prefills name, ID type and last 4', async () => {
    render(<VisitorForm onRegistered={vi.fn()} />);
    fireEvent.click(await screen.findByText('Scan ID card'));
    await waitFor(() => {
      expect(screen.getByText('Capture Card')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Capture Card'));
    await waitFor(() => {
      expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Use Details'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Rahul Verma')).toBeInTheDocument();
      expect(screen.getByDisplayValue('PAN')).toBeInTheDocument();
      expect(screen.getByDisplayValue('234F')).toBeInTheDocument();
    });
  });

  it('scan result does not overwrite a name the guard already typed', async () => {
    render(<VisitorForm onRegistered={vi.fn()} />);
    const nameInput = (await screen.findAllByRole('textbox'))[1];
    fireEvent.change(nameInput, { target: { value: 'Manually Typed Name' } });
    fireEvent.click(screen.getByText('Scan ID card'));
    fireEvent.click(screen.getByText('Capture Card'));
    await waitFor(() => {
      expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Use Details'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Manually Typed Name')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('PAN')).toBeInTheDocument();
    expect(screen.getByDisplayValue('234F')).toBeInTheDocument();
  });

  it('closes the overlay without applying anything', async () => {
    render(<VisitorForm onRegistered={vi.fn()} />);
    fireEvent.click(await screen.findByText('Scan ID card'));
    fireEvent.click(screen.getByText('Close'));
    await waitFor(() => {
      expect(screen.queryByText('Capture Card')).not.toBeInTheDocument();
    });
  });
});
