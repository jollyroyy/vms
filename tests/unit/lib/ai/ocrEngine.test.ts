import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { PaddleOcrService } = vi.hoisted(() => ({
  PaddleOcrService: vi.fn(),
}));

vi.mock('ppu-paddle-ocr/web', () => ({ PaddleOcrService }));
vi.mock('../../../../src/lib/ai/imageSource', () => ({
  toArrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
}));

import { createOcrEngine } from '../../../../src/lib/ai/ocrEngine';

describe('M-AI-OCR: createOcrEngine', () => {
  beforeEach(() => {
    PaddleOcrService.mockClear();
    PaddleOcrService.mockImplementation(function (this: any) {
      this.initialize = vi.fn(() => Promise.resolve());
      this.recognize = vi.fn(() =>
        Promise.resolve({
          results: [
            { text: 'ABCDE1234F', confidence: 0.97 },
            { text: 'NAME: John Smith', confidence: 0.92 },
          ],
          text: 'ABCDE1234F NAME: John Smith',
          confidence: 0.94,
        })
      );
      return this;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets the ORT wasm paths to the self-hosted /ort/ directory', async () => {
    await createOcrEngine();
    const ortEnv = (await import('onnxruntime-web')).env;
    expect(ortEnv.wasm.wasmPaths).toBe('/ort/');
    expect(ortEnv.wasm.numThreads).toBe(1);
  });

  it('constructs PaddleOcrService with the model paths from public/models/ocr/', async () => {
    await createOcrEngine();
    expect(PaddleOcrService).toHaveBeenCalledWith(
      expect.objectContaining({
        model: {
          detection: '/models/ocr/det.ort',
          recognition: '/models/ocr/rec.ort',
          charactersDictionary: '/models/ocr/dict.txt',
        },
      }),
    );
  });

  it('calls initialize before recognising', async () => {
    const engine = await createOcrEngine();
    const svc = PaddleOcrService.mock.results[0]?.value;
    expect(svc.initialize).toHaveBeenCalled();
  });

  it('recognise() returns lines and fullText joined by newline', async () => {
    const engine = await createOcrEngine();
    const result = await engine.recognise(new Blob(['img'], { type: 'image/png' }));
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toEqual({ text: 'ABCDE1234F', confidence: 0.97 });
    expect(result.lines[1]).toEqual({ text: 'NAME: John Smith', confidence: 0.92 });
    expect(result.fullText).toBe('ABCDE1234F\nNAME: John Smith');
  });

  it('propagates recognition errors as rejections', async () => {
    PaddleOcrService.mockImplementation(function (this: any) {
      this.initialize = vi.fn(() => Promise.resolve());
      this.recognize = vi.fn(() => Promise.reject(new Error('model crashed')));
      return this;
    });
    const engine = await createOcrEngine();
    await expect(engine.recognise(new Blob(['x']))).rejects.toThrow('model crashed');
  });
});
