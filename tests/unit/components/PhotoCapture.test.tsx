import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import PhotoCapture from '../../../src/components/PhotoCapture';

const mockGetUserMedia = vi.fn();
const mockTrackStop = vi.fn();

beforeEach(() => {
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
  // jsdom defaults these to 0; set them so computeCenterCrop doesn't throw
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: 1280, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: 720, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('M11-PHOTO-UI: PhotoCapture component', () => {
  it('shows idle state while camera is starting', async () => {
    mockGetUserMedia.mockReturnValue(new Promise(() => {})); // never resolves
    render(<PhotoCapture onCapture={() => {}} />);
    expect(screen.getByText('Starting camera...')).toBeInTheDocument();
  });

  it('transitions to streaming after camera starts', async () => {
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: mockTrackStop }],
    });
    render(<PhotoCapture onCapture={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Capture Photo')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows denied state when camera permission denied', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
    render(<PhotoCapture onCapture={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Camera access denied/i)).toBeInTheDocument();
    });
  });

  it('shows error state when camera fails for other reasons', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Camera not found'));
    render(<PhotoCapture onCapture={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Camera error/i)).toBeInTheDocument();
    });
  });

  it('shows fallback file picker in denied state', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
    render(<PhotoCapture onCapture={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/file picker/i)).toBeInTheDocument();
    });
  });

  it('transitions to frozen after capture', async () => {
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: mockTrackStop }],
    });
    render(<PhotoCapture onCapture={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Capture Photo')).toBeInTheDocument();
    }, { timeout: 5000 });
    fireEvent.click(screen.getByText('Capture Photo'));
    await waitFor(() => {
      expect(screen.getByText('Retake')).toBeInTheDocument();
      expect(screen.getByText('Use Photo')).toBeInTheDocument();
    });
  });

  it('calls onCapture with blob when Use Photo is clicked', async () => {
    const onCapture = vi.fn();
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: mockTrackStop }],
    });
    render(<PhotoCapture onCapture={onCapture} />);
    await waitFor(() => {
      expect(screen.getByText('Capture Photo')).toBeInTheDocument();
    }, { timeout: 5000 });
    fireEvent.click(screen.getByText('Capture Photo'));
    await waitFor(() => {
      expect(screen.getByText('Use Photo')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Use Photo'));
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(onCapture).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('returns to streaming on retake', { timeout: 15000 }, async () => {
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: mockTrackStop }],
    });
    render(<PhotoCapture onCapture={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Capture Photo')).toBeInTheDocument();
    }, { timeout: 5000 });
    fireEvent.click(screen.getByText('Capture Photo'));
    await waitFor(() => {
      expect(screen.getByText('Retake')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Retake'));
    await waitFor(() => {
      expect(screen.getByText('Capture Photo')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
