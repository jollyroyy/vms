import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetPage, mockGetDocument, mockDestroy } = vi.hoisted(() => ({
  mockGetPage: vi.fn(),
  mockGetDocument: vi.fn(),
  mockDestroy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: mockGetDocument,
}));

import { renderPdfFirstPage, isPdfFile } from '../../../src/lib/pdfQrPage';

const pdfFile = (name = 'pass.pdf', type = 'application/pdf') =>
  new File(['%PDF-1.4'], name, { type });

function makePdfDoc() {
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({ width: 400 * scale, height: 600 * scale }),
    render: vi.fn(() => ({ promise: Promise.resolve() })),
    cleanup: vi.fn(),
  };
  const pdf = {
    getPage: mockGetPage.mockResolvedValue(page),
    loadingTask: { destroy: mockDestroy },
  };
  mockGetDocument.mockReturnValue({ promise: Promise.resolve(pdf) });
  return { page, pdf };
}

describe('L-PDF-QR: isPdfFile', () => {
  it('returns true for application/pdf', () => {
    expect(isPdfFile(pdfFile('a.pdf', 'application/pdf'))).toBe(true);
  });

  it('returns true for a .PDF name with empty type (phone downloads folder case)', () => {
    expect(isPdfFile(pdfFile('PASS.PDF', ''))).toBe(true);
  });

  it('returns false for image/png', () => {
    expect(isPdfFile(new File(['x'], 'photo.png', { type: 'image/png' }))).toBe(false);
  });
});

describe('L-PDF-QR: renderPdfFirstPage', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;
  let toBlobSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockGetPage.mockReset();
    mockGetDocument.mockReset();
    mockDestroy.mockClear();
  });

  afterEach(() => {
    getContextSpy?.mockRestore();
    toBlobSpy?.mockRestore();
  });

  it('returns { ok: true, blob } with a PNG blob on the happy path', async () => {
    makePdfDoc();
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({} as unknown as CanvasRenderingContext2D);
    toBlobSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((cb: BlobCallback) => {
        cb(new Blob(['png-bytes'], { type: 'image/png' }));
      });

    const result = await renderPdfFirstPage(pdfFile());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blob.type).toBe('image/png');
    }
    expect(mockDestroy).toHaveBeenCalled();
  });

  it('returns { ok: false, reason: "engine" } when getDocument rejects (corrupt PDF)', async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.reject(new Error('bad xref')) });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await renderPdfFirstPage(pdfFile());

    expect(result).toEqual({ ok: false, reason: 'engine', detail: 'Error: bad xref' });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns { ok: false, reason: "engine" } and does not throw when toBlob yields null', async () => {
    makePdfDoc();
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({} as unknown as CanvasRenderingContext2D);
    toBlobSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((cb: BlobCallback) => {
        cb(null);
      });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await expect(renderPdfFirstPage(pdfFile())).resolves.toEqual({
      ok: false,
      reason: 'engine',
      detail: 'canvas.toBlob returned null',
    });
    void result;
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns { ok: false, reason: "engine" } when getContext yields null', async () => {
    makePdfDoc();
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await renderPdfFirstPage(pdfFile());

    expect(result).toEqual({
      ok: false,
      reason: 'engine',
      detail: 'canvas 2d context unavailable',
    });
    errorSpy.mockRestore();
  });
});
