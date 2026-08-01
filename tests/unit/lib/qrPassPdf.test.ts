import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Visit } from '../../../src/types/index';

const { mockDoc, MockJsPDF } = vi.hoisted(() => {
  const mockDoc = {
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    text: vi.fn(),
    addImage: vi.fn(),
    setTextColor: vi.fn(),
    save: vi.fn(),
  };
  const MockJsPDF = vi.fn(() => mockDoc);
  return { mockDoc, MockJsPDF };
});

vi.mock('jspdf', () => ({ jsPDF: MockJsPDF }));

import { downloadQrPassPdf } from '../../../src/lib/qrPassPdf';

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
  visitor: { id: 'vis1', phone: '9876543210', full_name: 'Asha Rao', company: 'Acme', is_blacklisted: false, blacklist_reason: null, created_at: '' } as any,
  department: { id: 'dept1', name: 'Finance', code: 'FIN', created_at: '' },
};

describe('L-QR-PDF: downloadQrPassPdf', () => {
  beforeEach(() => {
    MockJsPDF.mockClear();
    Object.values(mockDoc).forEach((fn) => fn.mockClear());
  });

  it('embeds the QR image in the generated PDF', () => {
    downloadQrPassPdf(baseVisit, QR_DATA_URL);
    expect(mockDoc.addImage).toHaveBeenCalledWith(QR_DATA_URL, 'PNG', expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
  });

  it('saves the file under a name that includes the visit ref number', () => {
    downloadQrPassPdf(baseVisit, QR_DATA_URL);
    expect(mockDoc.save).toHaveBeenCalledWith('entry-pass-VIS-20260801-0001.pdf');
  });

  it('prints the visitor name and department onto the page', () => {
    downloadQrPassPdf(baseVisit, QR_DATA_URL);
    const printed = mockDoc.text.mock.calls.map((call) => call[0]);
    expect(printed).toEqual(expect.arrayContaining([
      expect.stringContaining('Asha Rao'),
      expect.stringContaining('Finance'),
    ]));
  });

  it('omits the scheduled line when the visit has no scheduled_for', () => {
    downloadQrPassPdf(baseVisit, QR_DATA_URL);
    const printed = mockDoc.text.mock.calls.map((call) => call[0]);
    expect(printed.some((t: string) => t.startsWith('Scheduled:'))).toBe(false);
  });

  it('prints the scheduled time when the visit has one', () => {
    downloadQrPassPdf({ ...baseVisit, scheduled_for: '2026-08-02T10:30:00Z' }, QR_DATA_URL);
    const printed = mockDoc.text.mock.calls.map((call) => call[0]);
    expect(printed.some((t: string) => t.startsWith('Scheduled:'))).toBe(true);
  });
});
