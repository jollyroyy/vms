import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadQrPassPng } from '../../../src/lib/qrPassImage';
import type { Visit } from '../../../src/types/index';

const QR_DATA_URL = 'data:image/png;base64,abc123';

const baseVisit: Visit = {
  id: 'v1',
  ref_number: 'VIS-20260801-0001',
  visitor_id: 'vis1',
  department_id: 'dept1',
  host_id: 'h1',
  purpose: 'meeting',
  photo_path: null,
  photo_data: null,
  status: 'approved',
  checked_in_at: null,
  checked_out_at: null,
  exit_verified: null,
  rejection_reason: null,
  carrying_material: false,
  scheduled_for: null,
  qr_token: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  qr_expires_at: null,
  created_at: '2026-08-01T09:00:00Z',
};

describe('L-QR-PNG: downloadQrPassPng', () => {
  let clicked: HTMLAnchorElement | null;

  beforeEach(() => {
    clicked = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked = this;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the QR data URL as-is, so the file stays a decodable image', () => {
    downloadQrPassPng(baseVisit, QR_DATA_URL);
    expect(clicked!.href).toBe(QR_DATA_URL);
  });

  it('names the file with a .png extension and the visit ref number', () => {
    downloadQrPassPng(baseVisit, QR_DATA_URL);
    expect(clicked!.download).toBe('entry-pass-VIS-20260801-0001.png');
  });

  it('leaves no anchor behind in the document', () => {
    downloadQrPassPng(baseVisit, QR_DATA_URL);
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
