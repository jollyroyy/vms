import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockScanImage } = vi.hoisted(() => ({ mockScanImage: vi.fn() }));

vi.mock('qr-scanner', () => ({
  default: { scanImage: mockScanImage },
}));

import { decodeQrImage } from '../../../src/lib/decodeQrImage';

const file = new File(['x'], 'pass.png', { type: 'image/png' });

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
