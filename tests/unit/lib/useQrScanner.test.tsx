// L-QR-CAM: useQrScanner lifecycle.
//
// This hook had no test file, which is why a CSP that blocked qr-scanner's
// blob: worker sat undetected on the camera path: every failure collapsed into
// 'unavailable' ("Camera unavailable"), so a dead decode engine looked exactly
// like a machine with no webcam. The state split is the thing under test here.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const { mockHasCamera, mockStart, mockStop, mockDestroy, mockPause, ctorSpy, importImpl } = vi.hoisted(() => ({
  mockHasCamera: vi.fn(),
  mockStart: vi.fn(),
  mockStop: vi.fn(),
  mockDestroy: vi.fn(),
  mockPause: vi.fn(),
  ctorSpy: vi.fn(),
  importImpl: { current: null as null | (() => never) },
}));

vi.mock('qr-scanner', () => {
  class FakeQrScanner {
    static hasCamera = mockHasCamera;
    constructor(...args: unknown[]) {
      ctorSpy(...args);
    }
    start = mockStart;
    stop = mockStop;
    destroy = mockDestroy;
    pause = mockPause;
  }
  // Lets a test simulate the module itself failing to load (the CSP case).
  if (importImpl.current) importImpl.current();
  return { default: FakeQrScanner };
});

import { useQrScanner, type QrScannerState } from '../../../src/lib/useQrScanner';

function Probe(): React.ReactElement {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const { state } = useQrScanner({ videoRef, onDecode: vi.fn() });
  return (
    <div>
      <video ref={videoRef} />
      <span data-testid="state">{state satisfies QrScannerState}</span>
    </div>
  );
}

const stateText = () => screen.getByTestId('state').textContent;

describe('L-QR-CAM: useQrScanner', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    importImpl.current = null;
    mockHasCamera.mockResolvedValue(true);
    mockStart.mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('starts in the starting state', () => {
    mockHasCamera.mockReturnValue(new Promise(() => {})); // never settles
    render(<Probe />);
    expect(stateText()).toBe('starting');
  });

  it('reaches scanning once the camera stream starts', async () => {
    render(<Probe />);
    await waitFor(() => expect(stateText()).toBe('scanning'));
  });

  it('reports unavailable ONLY when there is genuinely no camera', async () => {
    mockHasCamera.mockResolvedValue(false);
    render(<Probe />);
    await waitFor(() => expect(stateText()).toBe('unavailable'));
  });

  it('reports error, not unavailable, when a present camera fails to start', async () => {
    // A dead decode engine or a denied permission must never be reported as
    // "no camera" — that sends the guard looking for different hardware.
    mockStart.mockRejectedValue(new Error('Scanner error: [object Event]'));
    render(<Probe />);
    await waitFor(() => expect(stateText()).toBe('error'));
  });

  it('logs the underlying reason when the scanner fails to start', async () => {
    mockStart.mockRejectedValue(new Error('NotAllowedError'));
    render(<Probe />);
    await waitFor(() => expect(console.error).toHaveBeenCalled());
  });

  it('tears the scanner down on unmount so the camera light goes out', async () => {
    const { unmount } = render(<Probe />);
    await waitFor(() => expect(stateText()).toBe('scanning'));
    unmount();
    expect(mockStop).toHaveBeenCalled();
    expect(mockDestroy).toHaveBeenCalled();
  });

  it('treats a hasCamera probe that throws as no camera', async () => {
    mockHasCamera.mockRejectedValue(new Error('enumerateDevices blew up'));
    render(<Probe />);
    await waitFor(() => expect(stateText()).toBe('unavailable'));
  });
});
