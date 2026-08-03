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

// The real converter needs a DOM Image + canvas; the contract this module
// depends on is just "give me a PNG data URL, or null if you couldn't".
const mockToPdfSafeImage = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/passPhoto', () => ({ toPdfSafeImage: mockToPdfSafeImage }));

import { downloadQrPassPdf } from '../../../src/lib/qrPassPdf';

const QR_DATA_URL = 'data:image/png;base64,abc123';
const CONVERTED = 'data:image/png;base64,CONVERTED';

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
  visitor: { id: 'vis1', phone: '9876543210', full_name: 'Asha Rao', vendor_name: 'Acme', id_type: null, id_last4: null, is_blacklisted: false, blacklist_reason: null, created_at: '' } as any,
  department: { id: 'dept1', name: 'Finance', code: 'FIN', created_at: '' },
};

describe('L-QR-PDF: downloadQrPassPdf', () => {
  beforeEach(() => {
    MockJsPDF.mockClear();
    Object.values(mockDoc).forEach((fn) => fn.mockClear());
    mockToPdfSafeImage.mockReset();
    mockToPdfSafeImage.mockResolvedValue(CONVERTED);
  });

  it('embeds the QR image in the generated PDF', async () => {
    await downloadQrPassPdf(baseVisit, QR_DATA_URL);
    expect(mockDoc.addImage).toHaveBeenCalledWith(QR_DATA_URL, 'PNG', expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
  });

  it('saves the file under a name that includes the visit ref number', async () => {
    await downloadQrPassPdf(baseVisit, QR_DATA_URL);
    expect(mockDoc.save).toHaveBeenCalledWith('entry-pass-VIS-20260801-0001.pdf');
  });

  it('prints the visitor name and department onto the page', async () => {
    await downloadQrPassPdf(baseVisit, QR_DATA_URL);
    const printed = mockDoc.text.mock.calls.map((call) => call[0]);
    expect(printed).toEqual(expect.arrayContaining([
      expect.stringContaining('Asha Rao'),
      expect.stringContaining('Finance'),
    ]));
  });

  it('omits the scheduled line when the visit has no scheduled_for', async () => {
    await downloadQrPassPdf(baseVisit, QR_DATA_URL);
    const printed = mockDoc.text.mock.calls.map((call) => call[0]);
    expect(printed.some((t: string) => t.startsWith('Scheduled:'))).toBe(false);
  });

  it('prints the scheduled time when the visit has one', async () => {
    await downloadQrPassPdf({ ...baseVisit, scheduled_for: '2026-08-02T10:30:00Z' }, QR_DATA_URL);
    const printed = mockDoc.text.mock.calls.map((call) => call[0]);
    expect(printed.some((t: string) => t.startsWith('Scheduled:'))).toBe(true);
  });

  it('calls addImage exactly once when no photo is provided', async () => {
    await downloadQrPassPdf(baseVisit, QR_DATA_URL);
    expect(mockDoc.addImage).toHaveBeenCalledTimes(1);
    expect(mockToPdfSafeImage).not.toHaveBeenCalled();
  });

  it('calls addImage twice when a photo is provided', async () => {
    await downloadQrPassPdf(baseVisit, QR_DATA_URL, 'data:image/webp;base64,photo123');
    expect(mockDoc.addImage).toHaveBeenCalledTimes(2);
  });

  // The bug this guards: photos are stored as WebP (and often as a remote
  // signed URL). Handing either straight to jsPDF throws, which silently cost
  // us the photo on every pass. It must go through the converter first.
  it('re-encodes a WebP photo before handing it to jsPDF', async () => {
    const webp = 'data:image/webp;base64,photo123';
    await downloadQrPassPdf(baseVisit, QR_DATA_URL, webp);
    expect(mockToPdfSafeImage).toHaveBeenCalledWith(webp);
    const sources = mockDoc.addImage.mock.calls.map((call) => call[0]);
    expect(sources).toContain(CONVERTED);
    expect(sources).not.toContain(webp);
  });

  it('re-encodes a remote signed URL rather than passing it through', async () => {
    const remote = 'https://project.supabase.co/storage/v1/object/sign/visitor-photos/x.webp?token=abc';
    await downloadQrPassPdf(baseVisit, QR_DATA_URL, remote);
    expect(mockToPdfSafeImage).toHaveBeenCalledWith(remote);
    const sources = mockDoc.addImage.mock.calls.map((call) => call[0]);
    expect(sources).not.toContain(remote);
  });

  it('draws the photo clear of the title and ref number', async () => {
    await downloadQrPassPdf(baseVisit, QR_DATA_URL, 'data:image/webp;base64,photo123');
    const photoCall = mockDoc.addImage.mock.calls.find((call) => call[0] === CONVERTED);
    // The ref number's baseline sits at y=58; anything above that overprints it.
    expect(photoCall?.[3]).toBeGreaterThan(58);
  });

  it('keeps the QR below the photo when both are present', async () => {
    await downloadQrPassPdf(baseVisit, QR_DATA_URL, 'data:image/webp;base64,photo123');
    const photoCall = mockDoc.addImage.mock.calls.find((call) => call[0] === CONVERTED);
    const qrCall = mockDoc.addImage.mock.calls.find((call) => call[0] === QR_DATA_URL);
    const photoBottom = (photoCall?.[3] ?? 0) + (photoCall?.[5] ?? 0);
    expect(qrCall?.[3]).toBeGreaterThanOrEqual(photoBottom);
  });

  it('still produces a pass when the photo cannot be converted', async () => {
    mockToPdfSafeImage.mockResolvedValue(null);
    await downloadQrPassPdf(baseVisit, QR_DATA_URL, 'data:image/webp;base64,broken');
    expect(mockDoc.addImage).toHaveBeenCalledTimes(1);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it('prints ID Proof label with redacted Aadhaar ID', async () => {
    const visitWithId = { ...baseVisit, visitor: { ...baseVisit.visitor, id_type: 'Aadhaar', id_last4: '9646' } };
    await downloadQrPassPdf(visitWithId, QR_DATA_URL);
    const printed = mockDoc.text.mock.calls.map((call) => call[0]);
    expect(printed).toEqual(expect.arrayContaining([
      expect.stringContaining('ID Proof:'),
      expect.stringContaining('Aadhaar ••••46'),
    ]));
  });

  it('never exposes the full ID number in the printed text', async () => {
    const visitWithId = { ...baseVisit, visitor: { ...baseVisit.visitor, id_type: 'Aadhaar', id_last4: '9646' } };
    await downloadQrPassPdf(visitWithId, QR_DATA_URL);
    const printed = mockDoc.text.mock.calls.map((call) => call[0]).join(' ');
    expect(printed).not.toMatch(/\b9646\b/);
  });

  it('still calls save even when photo addImage throws', async () => {
    mockDoc.addImage.mockImplementationOnce(() => { throw new Error('bad image'); });
    await expect(
      downloadQrPassPdf(baseVisit, QR_DATA_URL, 'data:image/webp;base64,corrupt'),
    ).resolves.toBeUndefined();
    expect(mockDoc.save).toHaveBeenCalled();
  });
});
