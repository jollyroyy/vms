// jsdom neither decodes images nor rasterises canvases, so both are stubbed.
// What is under test is the decision logic around them: does a remote source
// get crossOrigin (without which toDataURL throws SecurityError on a tainted
// canvas), and does every failure path degrade to null instead of throwing?
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toPdfSafeImage } from '../../../src/lib/passPhoto';

const PNG_OUT = 'data:image/png;base64,REENCODED';

let lastImage: FakeImage | null = null;

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  naturalWidth = 200;
  naturalHeight = 300;
  private _src = '';

  constructor() {
    lastImage = this;
  }

  get src(): string { return this._src; }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => {
      if (value.includes('BROKEN')) this.onerror?.();
      else this.onload?.();
    });
  }
}

function stubCanvas(ctx: unknown, toDataURL: () => string) {
  const canvas = { width: 0, height: 0, getContext: () => ctx, toDataURL };
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
    tag === 'canvas' ? canvas : ({} as HTMLElement)) as typeof document.createElement);
  return canvas;
}

describe('L-PASS-PHOTO: toPdfSafeImage', () => {
  beforeEach(() => {
    lastImage = null;
    vi.stubGlobal('Image', FakeImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('re-encodes a WebP data URL to a PNG data URL', async () => {
    stubCanvas({ drawImage: vi.fn() }, () => PNG_OUT);
    await expect(toPdfSafeImage('data:image/webp;base64,AAAA')).resolves.toBe(PNG_OUT);
  });

  // Without crossOrigin the canvas is tainted and toDataURL throws, which is
  // how a signed Supabase URL silently lost the photo.
  it('requests crossOrigin for a remote source', async () => {
    stubCanvas({ drawImage: vi.fn() }, () => PNG_OUT);
    await toPdfSafeImage('https://project.supabase.co/storage/v1/object/sign/x.webp?token=t');
    expect(lastImage?.crossOrigin).toBe('anonymous');
  });

  it('does not set crossOrigin for a data URL', async () => {
    stubCanvas({ drawImage: vi.fn() }, () => PNG_OUT);
    await toPdfSafeImage('data:image/webp;base64,AAAA');
    expect(lastImage?.crossOrigin).toBe('');
  });

  it('scales an oversized photo down to the 480px cap', async () => {
    const canvas = stubCanvas({ drawImage: vi.fn() }, () => PNG_OUT);
    vi.stubGlobal('Image', class extends FakeImage {
      naturalWidth = 4000;
      naturalHeight = 3000;
    });
    await toPdfSafeImage('data:image/webp;base64,AAAA');
    expect(Math.max(canvas.width, canvas.height)).toBe(480);
  });

  it('leaves a photo smaller than the cap at its own size', async () => {
    const canvas = stubCanvas({ drawImage: vi.fn() }, () => PNG_OUT);
    await toPdfSafeImage('data:image/webp;base64,AAAA');
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(300);
  });

  it('returns null when the image cannot be loaded', async () => {
    stubCanvas({ drawImage: vi.fn() }, () => PNG_OUT);
    await expect(toPdfSafeImage('https://example.com/BROKEN.webp')).resolves.toBeNull();
  });

  it('returns null when no 2D context is available', async () => {
    stubCanvas(null, () => PNG_OUT);
    await expect(toPdfSafeImage('data:image/webp;base64,AAAA')).resolves.toBeNull();
  });

  it('returns null rather than throwing when the canvas is tainted', async () => {
    stubCanvas({ drawImage: vi.fn() }, () => { throw new Error('SecurityError'); });
    await expect(toPdfSafeImage('https://example.com/photo.webp')).resolves.toBeNull();
  });

  it('returns null for an image that decodes to zero dimensions', async () => {
    stubCanvas({ drawImage: vi.fn() }, () => PNG_OUT);
    vi.stubGlobal('Image', class extends FakeImage {
      naturalWidth = 0;
      naturalHeight = 0;
      width = 0;
      height = 0;
    });
    await expect(toPdfSafeImage('data:image/webp;base64,AAAA')).resolves.toBeNull();
  });
});
