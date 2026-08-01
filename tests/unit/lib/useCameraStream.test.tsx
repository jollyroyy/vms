import React, { useRef, useEffect } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, waitFor, act } from '@testing-library/react';
import { useCameraStream, type CameraStreamOptions } from '../../../src/lib/useCameraStream';

const mockGetUserMedia = vi.fn();
const mockTrackStop = vi.fn();

beforeEach(() => {
  mockTrackStop.mockClear();
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia },
    configurable: true,
    writable: true,
  });
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    const blob = new Blob(['fake'], { type: 'image/webp' });
    cb(blob);
  };
  HTMLCanvasElement.prototype.getContext = function () {
    return { drawImage: vi.fn() } as any;
  };
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
  // jsdom defaults these to 0; set them so downstream consumers don't throw
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: 1280, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: 720, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Test harness: renders a real <video> element (so document.contains(video)
 *  is true, as the hook requires) and exposes the hook result via a ref-like
 *  side channel the assertions can read synchronously after each render. */
type Result = ReturnType<typeof useCameraStream>;

function Harness({
  options,
  onResult,
  mountVideo = true,
}: {
  options?: CameraStreamOptions;
  onResult: (r: Result) => void;
  mountVideo?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const result = useCameraStream(videoRef, options);
  useEffect(() => {
    onResult(result);
  });
  return mountVideo ? <video ref={videoRef} data-testid="video" /> : null;
}

function renderHarness(options?: CameraStreamOptions) {
  let latest!: Result;
  const onResult = (r: Result) => {
    latest = r;
  };
  const utils = render(<Harness options={options} onResult={onResult} />);
  return { ...utils, getResult: () => latest };
}

function fakeStream() {
  return { getTracks: () => [{ stop: mockTrackStop }] };
}

describe('M-CAM: useCameraStream', () => {
  it('starts as idle while getUserMedia is pending', async () => {
    mockGetUserMedia.mockReturnValue(new Promise(() => {})); // never resolves
    const { getResult } = renderHarness();
    await waitFor(() => {
      expect(getResult().status).toBe('idle');
    });
  });

  it('becomes streaming once getUserMedia resolves', async () => {
    mockGetUserMedia.mockResolvedValue(fakeStream());
    const { getResult } = renderHarness();
    await waitFor(
      () => {
        expect(getResult().status).toBe('streaming');
      },
      { timeout: 5000 },
    );
  });

  it('becomes denied when getUserMedia rejects with a permission error', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
    const { getResult } = renderHarness();
    await waitFor(() => {
      expect(getResult().status).toBe('denied');
    });
  });

  it('becomes denied for a NotAllowedError message', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('NotAllowedError: dismissed'));
    const { getResult } = renderHarness();
    await waitFor(() => {
      expect(getResult().status).toBe('denied');
    });
  });

  it('becomes error with the message exposed for a hardware fault', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Camera not found'));
    const { getResult } = renderHarness();
    await waitFor(() => {
      expect(getResult().status).toBe('error');
      expect(getResult().errorMessage).toBe('Camera not found');
    });
  });

  it('does not call getUserMedia on mount when autoStart is false, but start() does', async () => {
    mockGetUserMedia.mockResolvedValue(fakeStream());
    const { getResult } = renderHarness({ autoStart: false });
    await waitFor(() => {
      expect(getResult().status).toBe('idle');
    });
    expect(mockGetUserMedia).not.toHaveBeenCalled();

    await act(async () => {
      await getResult().start();
    });
    expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    await waitFor(
      () => {
        expect(getResult().status).toBe('streaming');
      },
      { timeout: 5000 },
    );
  });

  it('passes facingMode through into the video constraints', async () => {
    mockGetUserMedia.mockResolvedValue(fakeStream());
    const { getResult } = renderHarness({ facingMode: 'environment' });
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({ facingMode: 'environment' }),
        }),
      );
    });
    // Drain the hook's metadata-fallback timer (a real 3s setTimeout the hook
    // never cancels) within this test's own window, so it can't fire during
    // the next test and double-stop the shared track-stop spy there.
    await waitFor(
      () => {
        expect(getResult().status).toBe('streaming');
      },
      { timeout: 5000 },
    );
  });

  it('stops every track on unmount', async () => {
    mockGetUserMedia.mockResolvedValue(fakeStream());
    const { getResult, unmount } = renderHarness();
    await waitFor(
      () => {
        expect(getResult().status).toBe('streaming');
      },
      { timeout: 5000 },
    );
    unmount();
    expect(mockTrackStop).toHaveBeenCalledTimes(1);
  });

  it('stops every track when stop() is called explicitly', async () => {
    mockGetUserMedia.mockResolvedValue(fakeStream());
    const { getResult } = renderHarness();
    await waitFor(
      () => {
        expect(getResult().status).toBe('streaming');
      },
      { timeout: 5000 },
    );
    act(() => {
      getResult().stop();
    });
    expect(mockTrackStop).toHaveBeenCalledTimes(1);
  });
});
