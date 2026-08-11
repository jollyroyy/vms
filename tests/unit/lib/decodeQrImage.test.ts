import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockScanImage } = vi.hoisted(() => ({ mockScanImage: vi.fn() }));
const { mockIsPdfFile, mockRenderPdfFirstPage } = vi.hoisted(() => ({
  mockIsPdfFile: vi.fn(),
  mockRenderPdfFirstPage: vi.fn(),
}));

vi.mock('qr-scanner', () => ({
  default: { scanImage: mockScanImage },
}));

vi.mock('../../../src/lib/pdfQrPage', () => ({
  isPdfFile: mockIsPdfFile,
  renderPdfFirstPage: mockRenderPdfFirstPage,
}));

import { decodeQrImage, decodeQrFile } from '../../../src/lib/decodeQrImage';

const file = new File(['x'], 'pass.png', { type: 'image/png' });
const pdfFile = new File(['%PDF-1.4'], 'pass.pdf', { type: 'application/pdf' });

describe('L-QR-IMG: decodeQrImage', () => {
  beforeEach(() => {
    mockScanImage.mockReset();
  });

  it('returns { ok: true, payload } on a successful read', async () => {
    mockScanImage.mockResolvedValue({ data: 'vms://checkin/abc123', cornerPoints: [] });
    const result = await decodeQrImage(file);
    expect(result).toEqual({ ok: true, payload: 'vms://checkin/abc123' });
  });

  it('passes the file straight through to qr-scanner', async () => {
    mockScanImage.mockResolvedValue({ data: 'vms://checkin/abc123', cornerPoints: [] });
    await decodeQrImage(file);
    expect(mockScanImage).toHaveBeenCalledWith(file, expect.objectContaining({ alsoTryWithoutScanRegion: true }));
  });

  it('returns reason "no_code" when qr-scanner rejects with the bare "No QR code found" string', async () => {
    mockScanImage.mockRejectedValue('No QR code found');
    const result = await decodeQrImage(file);
    expect(result).toEqual({ ok: false, reason: 'no_code', detail: 'No QR code found' });
  });

  it('returns reason "engine" for an Error rejection (real-world case: CSP blocks the qr-scanner worker, surfacing as an Error rather than the bare "No QR code found" string)', async () => {
    mockScanImage.mockRejectedValue(new Error('Scanner error: [object Event]'));
    const result = await decodeQrImage(file);
    expect(result).toEqual({
      ok: false,
      reason: 'engine',
      detail: 'Error: Scanner error: [object Event]',
    });
  });

  it('returns reason "engine" for any other string rejection', async () => {
    mockScanImage.mockRejectedValue('Scanner error: timeout');
    const result = await decodeQrImage(file);
    expect(result).toEqual({ ok: false, reason: 'engine', detail: 'Scanner error: timeout' });
  });

  it('logs via console.error on an engine failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockScanImage.mockRejectedValue(new Error('Scanner error: [object Event]'));
    await decodeQrImage(file);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('does not log via console.error on a no_code failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockScanImage.mockRejectedValue('No QR code found');
    await decodeQrImage(file);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('L-QR-FILE: decodeQrFile', () => {
  beforeEach(() => {
    mockScanImage.mockReset();
    mockIsPdfFile.mockReset();
    mockRenderPdfFirstPage.mockReset();
  });

  it('sends a non-PDF file straight through the image path, never touching pdfQrPage render', async () => {
    mockIsPdfFile.mockReturnValue(false);
    mockScanImage.mockResolvedValue({ data: 'vms://checkin/abc123', cornerPoints: [] });
    const result = await decodeQrFile(file);
    expect(result).toEqual({ ok: true, payload: 'vms://checkin/abc123' });
    expect(mockRenderPdfFirstPage).not.toHaveBeenCalled();
  });

  it('renders a PDF and decodes its first page', async () => {
    mockIsPdfFile.mockReturnValue(true);
    mockRenderPdfFirstPage.mockResolvedValue({ ok: true, blob: new Blob(['x'], { type: 'image/png' }) });
    mockScanImage.mockResolvedValue({ data: 'vms://checkin/xyz789', cornerPoints: [] });
    const result = await decodeQrFile(pdfFile);
    expect(result).toEqual({ ok: true, payload: 'vms://checkin/xyz789' });
  });

  it('returns reason "engine" with the detail preserved when the PDF render fails', async () => {
    mockIsPdfFile.mockReturnValue(true);
    mockRenderPdfFirstPage.mockResolvedValue({ ok: false, reason: 'engine', detail: 'pdfjs worker crashed' });
    const result = await decodeQrFile(pdfFile);
    expect(result).toEqual({ ok: false, reason: 'engine', detail: 'pdfjs worker crashed' });
    expect(mockScanImage).not.toHaveBeenCalled();
  });

  it('returns reason "no_code" when the PDF renders fine but holds no QR', async () => {
    mockIsPdfFile.mockReturnValue(true);
    mockRenderPdfFirstPage.mockResolvedValue({ ok: true, blob: new Blob(['x'], { type: 'image/png' }) });
    mockScanImage.mockRejectedValue('No QR code found');
    const result = await decodeQrFile(pdfFile);
    expect(result).toEqual({ ok: false, reason: 'no_code', detail: 'No QR code found' });
  });
});
