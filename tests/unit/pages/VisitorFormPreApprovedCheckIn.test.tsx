// Covers VisitorForm.checkInPreApproved: a photo is now mandatory to check in
// a pre-approved visitor from the walk-in form. It used to flip status to
// checked_in with no photo at all; it now returns early with
// 'Photo is required (FR-CAM-05).' and, on success, uploads the photo into
// photo_data/photo_path on the visit update. jsdom has no camera, so
// PhotoCapture is stubbed with a button that fires onCapture with a real
// Blob — the same pattern used in GuardWalkInApproved.test.tsx.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import VisitorForm from '../../../src/pages/Guard/VisitorForm';

vi.mock('../../../src/components/PhotoCapture', () => ({
  default: ({ onCapture }: { onCapture: (blob: Blob) => void }) => (
    <button type="button" onClick={() => onCapture(new Blob(['photo'], { type: 'image/webp' }))}>
      Mock Capture
    </button>
  ),
}));

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockUpload = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    storage: {
      from: () => ({
        upload: mockUpload,
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed.jpg' } }),
      }),
    },
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
  },
}));

beforeEach(() => {
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const mockDepts = [
  { id: 'dept-it', name: 'Information Technology', code: 'IT', created_at: '2026-01-01' },
];

const preApprovedVisitor = { id: 'visitor-1', full_name: 'Asha Rao', vendor_name: 'Acme Co' };

const preApprovedRow = {
  id: 'visit-1',
  ref_number: 'VMS-2026-0001',
  purpose: 'meeting',
  photo_data: null,
  department: { name: 'Information Technology' },
};

function setupMocks() {
  mockUpdate.mockReset().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  mockUpload.mockReset().mockResolvedValue({ error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'departments') {
      return { select: () => ({ order: vi.fn().mockResolvedValue({ data: mockDepts, error: null }) }) };
    }
    if (table === 'visitors') {
      return {
        select: (cols: string) => {
          if (cols.includes('blacklist_reason')) {
            return { eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
          }
          // recallByPhone: select('*').eq('phone', normalized).maybeSingle()
          return { eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: preApprovedVisitor, error: null }) }) };
        },
      };
    }
    if (table === 'visits') {
      return {
        select: (cols: string) => {
          if (cols.includes('ref_number')) {
            // recallByPhone's own pre-approval lookup
            return { eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: preApprovedRow, error: null }) }) }) };
          }
          // findActiveVisitByPhone: no clash by default
          return { eq: () => ({ eq: () => ({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) };
        },
        update: mockUpdate,
      };
    }
    return { select: () => ({ eq: vi.fn() }) };
  });

  mockRpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
}

async function renderWithPreApprovedMatch() {
  render(<VisitorForm onRegistered={vi.fn()} />);
  await waitFor(() => expect(screen.getByText('Register New Visitor')).toBeInTheDocument());
  const phoneInput = screen.getByPlaceholderText('+91 98765 43210');
  fireEvent.change(phoneInput, { target: { value: '9876543210' } });
  fireEvent.blur(phoneInput);
  await waitFor(() => expect(screen.getByText('Pre-Approved Visitor')).toBeInTheDocument());
}

describe('VisitorForm pre-approved check-in — photo required (FR-CAM-05)', () => {
  beforeEach(() => setupMocks());

  it('disables Check In Now with no photo', async () => {
    await renderWithPreApprovedMatch();
    expect(screen.getByText('Check In Now').closest('button')).toBeDisabled();
  });

  it('enables Check In Now once a photo is captured', async () => {
    await renderWithPreApprovedMatch();
    fireEvent.click(screen.getByText('Mock Capture'));
    await waitFor(() => expect(screen.getByText('Check In Now').closest('button')).not.toBeDisabled());
  });

  it('includes the captured photo in the visit update on check-in', async () => {
    await renderWithPreApprovedMatch();
    fireEvent.click(screen.getByText('Mock Capture'));
    await waitFor(() => expect(screen.getByText('Check In Now').closest('button')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Check In Now'));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const payload = mockUpdate.mock.calls[0][0];
    expect(payload.status).toBe('checked_in');
    expect(payload.photo_data ?? payload.photo_path).toBeTruthy();
  });
});
