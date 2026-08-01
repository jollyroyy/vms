import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toArrayBuffer } from '../../../../src/lib/ai/imageSource';

const mockDrawImage = vi.fn();
const mockGetContext = vi.fn(() => ({ drawImage: mockDrawImage }));
const mockToBlob = vi.fn(function (cb: BlobCallback) {
  cb(new Blob(['fake-png'], { type: 'image/png' }));
});

beforeEach(() => {
  mockDrawImage.mockClear();
  mockGetContext.mockClear();
  mockToBlob.mockClear();

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: mockGetContext, configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    value: mockToBlob, configurable: true,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    value: 1280, configurable: true,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    value: 720, configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('M-AI-IMG: toArrayBuffer', () => {
  it('returns the Blob buffer directly without drawing', async () => {
    const blob = new Blob(['raw-bytes'], { type: 'image/png' });
    const buf = await toArrayBuffer(blob);
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(buf)).toBe('raw-bytes');
    expect(mockGetContext).not.toHaveBeenCalled();
  });

  it('returns the canvas buffer via toBlob (no drawToCanvas for canvas inputs)', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 80;
    const buf = await toArrayBuffer(canvas);
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(mockToBlob).toHaveBeenCalledTimes(1);
    expect(mockDrawImage).not.toHaveBeenCalled();
  });

  it('draws a video element at its native resolution', async () => {
    const video = document.createElement('video');
    await toArrayBuffer(video);
    expect(mockGetContext).toHaveBeenCalledTimes(1);
    expect(mockDrawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720);
  });

  it('draws an ImageBitmap at its declared resolution', async () => {
    // jsdom doesn't ship ImageBitmap; stub a mock class so instanceof works.
    const MockBitmap = class {
      width = 640;
      height = 480;
    };
    vi.stubGlobal('ImageBitmap', MockBitmap);
    const bitmap = new MockBitmap();

    await toArrayBuffer(bitmap as any);
    expect(mockGetContext).toHaveBeenCalledTimes(1);
    expect(mockDrawImage).toHaveBeenCalledWith(bitmap, 0, 0, 640, 480);
  });

  it('throws on a zero-dimension video', async () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'videoWidth', { value: 0, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 0, configurable: true });
    await expect(toArrayBuffer(video)).rejects.toThrow(/zero width or height/);
  });

  it('throws on a zero-dimension ImageBitmap', async () => {
    const MockBitmap = class {
      width = 0;
      height = 0;
    };
    vi.stubGlobal('ImageBitmap', MockBitmap);
    const bitmap = new MockBitmap();
    await expect(toArrayBuffer(bitmap as any)).rejects.toThrow(/zero width or height/);
  });

  it('throws on an unsupported image source', async () => {
    await expect(toArrayBuffer('not-an-image' as any)).rejects.toThrow(/Unsupported image source/);
  });
});
