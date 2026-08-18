import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import PreApprovalPass from '../../../src/components/PreApprovalPass';
import type { Visit } from '../../../src/types/index';

const mockDownloadQrPassPdf = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/qrPassPdf', () => ({ downloadQrPassPdf: mockDownloadQrPassPdf }));

const mockDownloadQrPassPng = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/qrPassImage', () => ({ downloadQrPassPng: mockDownloadQrPassPng }));

afterEach(cleanup);

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
  // Relative, not a hardcoded date. This was pinned to a fixed "later today"
  // timestamp, so the whole suite silently went red the day the wall clock
  // caught up to it: evaluateQrVisit checks expiry *before* status, so every
  // gate assertion in this file started reporting "This QR code has expired."
  qr_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  created_at: '2026-08-01T09:00:00Z',
};

describe('M-QR-PASS: PreApprovalPass', () => {
  beforeEach(() => {
    mockDownloadQrPassPdf.mockReset();
    mockDownloadQrPassPng.mockReset();
  });

  it('renders the ref number', () => {
    render(<PreApprovalPass visit={baseVisit} />);
    expect(screen.getByText(/VIS-20260801-0001/)).toBeInTheDocument();
  });

  it('renders a QR code image once generated', async () => {
    render(<PreApprovalPass visit={baseVisit} />);
    const img = await screen.findByAltText('Entry pass QR code');
    expect(img).toHaveAttribute('src', expect.stringContaining('data:image/png'));
  });

  it('shows a loading placeholder before the QR resolves', () => {
    render(<PreApprovalPass visit={baseVisit} />);
    expect(screen.queryByAltText('Entry pass QR code')).not.toBeInTheDocument();
  });

  it('regenerates the QR when the token changes', async () => {
    const { rerender } = render(<PreApprovalPass visit={baseVisit} />);
    const firstImg = await screen.findByAltText('Entry pass QR code');
    const firstSrc = firstImg.getAttribute('src');

    rerender(<PreApprovalPass visit={{ ...baseVisit, qr_token: 'different-token-0123456789' }} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const secondImg = await screen.findByAltText('Entry pass QR code');
    expect(secondImg.getAttribute('src')).not.toBe(firstSrc);
  });

  it('disables both download buttons until the QR has resolved', () => {
    render(<PreApprovalPass visit={baseVisit} />);
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /download image/i })).toBeDisabled();
  });

  it('downloads a PNG of the QR — the format the guard console can decode', async () => {
    render(<PreApprovalPass visit={baseVisit} />);
    const button = await screen.findByRole('button', { name: /download image/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    expect(mockDownloadQrPassPng).toHaveBeenCalledWith(
      baseVisit,
      expect.stringContaining('data:image/png'),
    );
  });

  it('downloads a PDF of the pass once the QR is ready', async () => {
    render(<PreApprovalPass visit={baseVisit} />);
    const button = await screen.findByRole('button', { name: /download pdf/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(mockDownloadQrPassPdf).toHaveBeenCalledWith(
      baseVisit,
      expect.stringContaining('data:image/png'),
      null,
    ));
  });

  it('hands the visitor photo to the PDF so the pass carries it next to the QR', async () => {
    const withPhoto = { ...baseVisit, photo_data: 'data:image/webp;base64,PHOTO' };
    render(<PreApprovalPass visit={withPhoto} />);
    const button = await screen.findByRole('button', { name: /download pdf/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(mockDownloadQrPassPdf).toHaveBeenCalledWith(
      withPhoto,
      expect.stringContaining('data:image/png'),
      'data:image/webp;base64,PHOTO',
    ));
  });

  it('tells the guard to scan while the QR is still live', async () => {
    render(<PreApprovalPass visit={baseVisit} />);
    expect(screen.getByText(/scan this at the guard console/i)).toBeInTheDocument();
  });

  // The pass stays downloadable after check-in so a lost badge can be
  // reprinted — but the QR itself is spent, and the pass must say so rather
  // than sending someone back to the gate with a code that will be rejected.
  it('warns that the code is spent once the visitor is checked in', async () => {
    render(<PreApprovalPass visit={{ ...baseVisit, status: 'checked_in' }} />);
    expect(screen.getByText(/already checked in/i)).toBeInTheDocument();
    expect(screen.queryByText(/scan this at the guard console/i)).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /download pdf/i })).toBeInTheDocument();
  });

  it('shows the visitor photo and their redacted ID alongside the QR', async () => {
    render(<PreApprovalPass visit={{
      ...baseVisit,
      photo_data: 'data:image/webp;base64,PHOTO',
      visitor: { id: 'vis1', phone: '9876543210', full_name: 'Asha Rao', vendor_name: 'Acme', id_type: 'Aadhaar', id_last4: '9646', vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: '' },
    }} />);
    expect(screen.getByAltText('Visitor photo')).toHaveAttribute('src', 'data:image/webp;base64,PHOTO');
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Aadhaar ••••46')).toBeInTheDocument();
    expect(screen.queryByText(/9646/)).not.toBeInTheDocument();
  });

  // The pre-approval case: the pass is issued before the visitor exists as a
  // face, so the photo slot is ABSENT rather than empty, and comes back by
  // itself at check-in when `photo_data` lands on the row (asserted above).
  it('still renders the pass when the visitor has no photo and no ID on record', async () => {
    render(<PreApprovalPass visit={baseVisit} />);
    expect(screen.queryByLabelText('No visitor photo on record')).not.toBeInTheDocument();
    expect(screen.queryByAltText('Visitor photo')).not.toBeInTheDocument();
    expect(screen.getByText('ID Proof')).toBeInTheDocument();
    expect(await screen.findByAltText('Entry pass QR code')).toBeInTheDocument();
  });

  // 2026-08-10 client report (second pass): opening a pass from inside the
  // VisitorDetails popup repeated the visitor's name, company and ID that the
  // popup header already showed. When the caller renders identity elsewhere,
  // the pass must keep only ref/status, the scheduled time and the QR —
  // never a second identity block.
  it('omits identity and Person-to-Meet when identityShownElsewhere, leaving QR and timing', async () => {
    render(<PreApprovalPass visit={{
      ...baseVisit,
      host: { id: 'h1', full_name: 'Jane Smith' },
      department: { id: 'd1', name: 'Engineering', code: 'ENG', created_at: '' },
      visitor: { id: 'vis1', phone: '9876543210', full_name: 'Asha Rao', vendor_name: 'Acme', id_type: 'Aadhaar', id_last4: '9646', vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: '' },
    }} identityShownElsewhere />);
    expect(screen.queryByText('Asha Rao')).not.toBeInTheDocument();
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
    expect(screen.queryByText('Company')).not.toBeInTheDocument();
    expect(screen.queryByText('ID Proof')).not.toBeInTheDocument();
    expect(screen.queryByText('Person to Meet')).not.toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    // "Valid For" was one mislabelled row; the pass now shows two, Scheduled
    // At and Valid Until (2026-08-15 client report).
    expect(screen.getByText('Scheduled At')).toBeInTheDocument();
    expect(screen.getByText('Valid Until')).toBeInTheDocument();
    expect(await screen.findByAltText('Entry pass QR code')).toBeInTheDocument();
  });
});

// Part 2 of the popup-close audit: the pass is read at a gate under time
// pressure, so it must group who/whom-they're-meeting/validity/status into
// labelled blocks rather than one flat list, and use the app's own status
// colour tokens (never a parallel palette).
describe('M-QR-PASS: PreApprovalPass — scannable hierarchy', () => {
  it('shows a status badge using the shared STATUS_STYLES label', () => {
    render(<PreApprovalPass visit={{ ...baseVisit, status: 'checked_in' }} />);
    expect(screen.getByText('On-site')).toBeInTheDocument();
  });

  it('groups the person being met and their department under "Person to Meet"', () => {
    render(<PreApprovalPass visit={{
      ...baseVisit,
      host: { id: 'h1', full_name: 'Jane Smith' },
      department: { id: 'd1', name: 'Engineering', code: 'ENG', created_at: '' },
    }} />);
    expect(screen.getByText('Person to Meet')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('renders "—" for a missing Person to Meet instead of a blank', () => {
    render(<PreApprovalPass visit={baseVisit} />);
    const label = screen.getByText('Person to Meet');
    expect(label.closest('div')?.parentElement?.textContent).toContain('—');
  });

  it('never introduces the word "Host" into the label', () => {
    render(<PreApprovalPass visit={baseVisit} />);
    expect(screen.queryByText(/\bHost\b/)).not.toBeInTheDocument();
  });

  it('keeps the QR at least 128px so it stays scannable, not shrunk for aesthetics', async () => {
    render(<PreApprovalPass visit={baseVisit} />);
    const img = await screen.findByAltText('Entry pass QR code');
    expect(img.className).toMatch(/w-3[2-9]|w-4[0-9]/);
  });
});
