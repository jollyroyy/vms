import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import IdScanOverlay from '../../../src/pages/Guard/IdScanOverlay';

const mockUseCameraStream = vi.hoisted(() => vi.fn());
const mockGetEngine = vi.hoisted(() => vi.fn());
const mockRecognise = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/useCameraStream', () => ({ useCameraStream: mockUseCameraStream }));
vi.mock('../../../src/lib/ai/engine', () => ({ getEngine: mockGetEngine }));

const camera = { status: 'streaming', errorMessage: '', start: vi.fn(), stop: vi.fn() };

function setupOcrEngine() {
  mockGetEngine.mockReturnValue({
    id: 'browser-wasm',
    ocr: vi.fn().mockResolvedValue({ recognise: mockRecognise }),
    face: vi.fn(),
  });
}

const PAN_TEXT = [
  'INCOME TAX DEPARTMENT',
  'PERMANENT ACCOUNT NUMBER',
  'ABCDE1234F',
  'Name: Rahul Verma',
].join('\n');

beforeEach(() => {
  mockUseCameraStream.mockReturnValue(camera);
  setupOcrEngine();
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 1280 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 720 });
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['frame'], { type: 'image/jpeg' }));
  };
  HTMLCanvasElement.prototype.getContext = function () {
    return { drawImage: vi.fn() } as any;
  };
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
  mockRecognise.mockResolvedValue({ lines: [{ text: PAN_TEXT, confidence: 0.9 }], fullText: PAN_TEXT });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('M-AI-OCR-UI: IdScanOverlay camera capture', () => {
  it('renders live camera preview and capture button while streaming', () => {
    render(<IdScanOverlay onScanned={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('scan-video')).toBeInTheDocument();
    expect(screen.getByText('Capture Card')).toBeInTheDocument();
  });

  it('capture draws the frame and runs OCR, then shows the review', async () => {
    const onScanned = vi.fn();
    render(<IdScanOverlay onScanned={onScanned} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Capture Card'));
    await waitFor(() => {
      expect(mockRecognise).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('PAN')).toBeInTheDocument();
      expect(screen.getByText(/XXXXXX234F/)).toBeInTheDocument();
      expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
    });
  });

  it('Use Details calls onScanned with type label, last-4 and name', async () => {
    const onScanned = vi.fn();
    render(<IdScanOverlay onScanned={onScanned} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Capture Card'));
    fireEvent.click(await screen.findByText('Use Details'));
    expect(onScanned).toHaveBeenCalledWith({ idType: 'PAN', idLast4: '234F', name: 'Rahul Verma' });
  });

  it('Camera denied shows the file fallback', () => {
    mockUseCameraStream.mockReturnValue({ status: 'denied', errorMessage: '', start: vi.fn(), stop: vi.fn() });
    render(<IdScanOverlay onScanned={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/Camera access denied/)).toBeInTheDocument();
    expect(screen.getByTestId('scan-file-input')).toBeInTheDocument();
  });

  it('file input runs OCR on the selected image', async () => {
    render(<IdScanOverlay onScanned={vi.fn()} onClose={vi.fn()} />);
    const input = screen.getByTestId('scan-file-input') as HTMLInputElement;
    const file = new File(['x'], 'card.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(mockRecognise).toHaveBeenCalled());
    expect(await screen.findByText('PAN')).toBeInTheDocument();
  });

  it('rejects non-image files without touching the engine', async () => {
    render(<IdScanOverlay onScanned={vi.fn()} onClose={vi.fn()} />);
    const input = screen.getByTestId('scan-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => {
      expect(screen.getByText(/image file/)).toBeInTheDocument();
    });
    expect(mockRecognise).not.toHaveBeenCalled();
  });
});

describe('M-AI-OCR-UI: IdScanOverlay failures', () => {
  it('shows an error when the OCR engine cannot be loaded', async () => {
    mockGetEngine.mockReturnValue({
      id: 'browser-wasm',
      ocr: vi.fn().mockRejectedValue(new Error('WASM download failed')),
      face: vi.fn(),
    });
    render(<IdScanOverlay onScanned={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Capture Card'));
    await waitFor(() => {
      expect(screen.getByText(/WASM download failed/)).toBeInTheDocument();
    });
  });

  it('shows an error when OCR fails', async () => {
    mockRecognise.mockRejectedValue(new Error('Inference crashed'));
    render(<IdScanOverlay onScanned={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Capture Card'));
    await waitFor(() => {
      expect(screen.getByText(/Inference crashed/)).toBeInTheDocument();
    });
  });

  it('reports when no government ID document is recognised', async () => {
    mockRecognise.mockResolvedValue({ lines: [{ text: 'hello world', confidence: 0.5 }], fullText: 'hello world' });
    render(<IdScanOverlay onScanned={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Capture Card'));
    await waitFor(() => {
      expect(screen.getByText(/no government ID/i)).toBeInTheDocument();
    });
  });

  it('Retry returns to the camera preview after an error', async () => {
    mockRecognise.mockRejectedValueOnce(new Error('Inference crashed'));
    render(<IdScanOverlay onScanned={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Capture Card'));
    await waitFor(() => expect(screen.getByText(/Inference crashed/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Retry'));
    expect(screen.getByText('Capture Card')).toBeInTheDocument();
  });
});

describe('M-AI-OCR-UI: IdScanOverlay close', () => {
  it('Close calls onClose', () => {
    const onClose = vi.fn();
    render(<IdScanOverlay onScanned={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
