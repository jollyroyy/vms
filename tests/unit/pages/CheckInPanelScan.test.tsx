import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { freezeIstClock, unfreezeIstClock } from '../helpers/istClock';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import CheckInPanel from '../../../src/pages/Guard/CheckInPanel';

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockUseCameraStream = vi.hoisted(() => vi.fn());
const mockGetEngine = vi.hoisted(() => vi.fn());
const mockRecognise = vi.hoisted(() => vi.fn());
const visitorsUpdate = vi.hoisted(() => vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })));
const visitsUpdate = vi.hoisted(() => vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })));
// Rows lib/activeVisit should find when it asks "is this person already
// inside?". Empty by default — these tests are about the happy path.
const alreadyInside = vi.hoisted(() => ({ current: [] as any[] }));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://cdn/signed.jpg' }, error: null }),
      }),
    },
  },
}));
vi.mock('../../../src/lib/useCameraStream', () => ({ useCameraStream: mockUseCameraStream }));
vi.mock('../../../src/lib/ai/engine', () => ({ getEngine: mockGetEngine }));

const mockDepts = [
  { id: 'dept-it', name: 'Information Technology', code: 'IT', created_at: '2026-01-01' },
];

const visit = {
  id: 'v1',
  visitor_id: 'vis1',
  status: 'approved',
  purpose: 'meeting',
  created_at: new Date().toISOString(),
  scheduled_for: null,
  host_id: 'h1',
  photo_data: null,
  visitor: { id: 'vis1', full_name: 'Rahul Verma', phone: '9876543210', vendor_name: null },
  department: { id: 'dept-it', name: 'Information Technology', code: 'IT', created_at: '2026-01-01' },
};

const PAN_TEXT = [
  'INCOME TAX DEPARTMENT',
  'PERMANENT ACCOUNT NUMBER',
  'ABCDE1234F',
  'Name: Rahul Verma',
].join('\n');

beforeEach(() => {
  // Frozen at midday IST. These fixtures are anchored to "today", and since
  // migration 075 ended the IST day at 22:00 they stop being due today for the
  // last two hours of every real day — the suite used to pass all day and fail
  // each evening. See tests/unit/helpers/istClock.ts.
  freezeIstClock();
  vi.stubEnv('VITE_FEATURE_OCR', 'true');
  mockUseCameraStream.mockReturnValue({ status: 'streaming', errorMessage: '', start: vi.fn(), stop: vi.fn() });
  mockGetEngine.mockReturnValue({
    id: 'browser-wasm',
    ocr: vi.fn().mockResolvedValue({ recognise: mockRecognise }),
    face: vi.fn(),
  });
  mockRecognise.mockResolvedValue({ lines: [{ text: PAN_TEXT, confidence: 0.9 }], fullText: PAN_TEXT });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 1280 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 720 });
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['frame'], { type: 'image/jpeg' }));
  };
  HTMLCanvasElement.prototype.getContext = function () {
    return { drawImage: vi.fn() } as any;
  };
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

  mockRpc.mockImplementation((name: string) => {
    if (name === 'get_profile_names') return Promise.resolve({ data: [{ id: 'h1', full_name: 'Priya Sharma', role: 'hod' }], error: null });
    return Promise.resolve({ data: null, error: null });
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'departments') {
      return { select: () => ({ order: vi.fn().mockResolvedValue({ data: mockDepts, error: null }) }) };
    }
    if (table === 'visits') {
      return {
        select: (cols: string) => {
          if (cols === 'id, visitor_id, status') {
            return { in: () => ({ gte: () => Promise.resolve({ data: [], error: null }) }) };
          }
          // checkInScannedVisit's visitor lookup. It carries the blacklist
          // columns because the watchlist gate reads them here — a valid pass
          // is not the same as a visitor who is still welcome.
          if (cols.startsWith('visitor_id')) {
            return { eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { visitor_id: 'vis1', visitor: { is_blacklisted: false, blacklist_reason: null } }, error: null }) }) };
          }
          // lib/activeVisit's "is this person already inside?" lookup —
          // chainable .eq() ending in .limit(). Returns whatever
          // alreadyInside.current holds; empty means nobody is inside.
          if (cols.includes('visitor:visitors!inner')) {
            const chain: any = { eq: () => chain, limit: () => Promise.resolve({ data: alreadyInside.current, error: null }) };
            return chain;
          }
          return {
            in: () => ({ order: () => Promise.resolve({ data: [visit], error: null }) }),
          };
        },
        update: visitsUpdate,
      };
    }
    if (table === 'recurring_visits') {
      return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    }
    if (table === 'visitors') {
      return {
        select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })),
        update: visitorsUpdate,
        upsert: vi.fn().mockReturnValue({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'vis1' }, error: null }) }) }),
      };
    }
    if (table === 'audit_logs') {
      return {
        select: () => ({
          eq: () => ({
            in: () => ({
              in: () => ({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      };
    }
    return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
  });
});

afterEach(() => {
  unfreezeIstClock();
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  alreadyInside.current = [];
});

describe('M-AI-OCR-UI: CheckInPanel — ID scan at pre-approved check-in', () => {
  it('persists scanned ID type and last 4 on the visitor when checking in', async () => {
    render(<CheckInPanel today="2026-08-01" onCheckInSuccess={vi.fn()} />);

    const matchCard = await screen.findByText('Rahul Verma');
    fireEvent.click(matchCard);

    fireEvent.click(await screen.findByText('Scan ID card'));
    fireEvent.click(await screen.findByText('Capture Card'));
    fireEvent.click(await screen.findByText('Use Details'));
    await waitFor(() => {
      expect(screen.getByText('Identity verified')).toBeInTheDocument();
    });

    fireEvent.click(await screen.findByText('Capture Photo'));
    fireEvent.click(await screen.findByText('Use Photo'));
    fireEvent.change(screen.getByLabelText(/Visitor card number/i), { target: { value: 'C-104' } });
    fireEvent.click(await screen.findByText('Check In'));

    await waitFor(() => {
      expect(visitorsUpdate).toHaveBeenCalledWith({ id_type: 'PAN', id_last4: '234F' });
      expect(visitsUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'checked_in' }));
    });
  });

  it('persists the carrying flag and the guard\'s remarks when the box is ticked', async () => {
    render(<CheckInPanel today="2026-08-01" onCheckInSuccess={vi.fn()} />);

    fireEvent.click(await screen.findByText('Rahul Verma'));

    fireEvent.click(await screen.findByText('Capture Photo'));
    fireEvent.click(await screen.findByText('Use Photo'));

    // The remarks field is gated behind the tick box — the flag is an explicit
    // answer now, not an inference from whether the guard typed anything.
    fireEvent.click(await screen.findByLabelText(/Carrying material/i));
    fireEvent.change(screen.getByPlaceholderText(/laptop/i), {
      target: { value: 'Dell XPS laptop, black briefcase' },
    });
    fireEvent.change(screen.getByLabelText(/Visitor card number/i), { target: { value: 'C-104' } });

    fireEvent.click(await screen.findByText('Check In'));

    await waitFor(() => {
      expect(visitsUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'checked_in',
        carrying_material: true,
        carrying_remarks: 'Dell XPS laptop, black briefcase',
      }));
    });
  });

  it('records carrying_material false when the box is left unticked', async () => {
    render(<CheckInPanel today="2026-08-01" onCheckInSuccess={vi.fn()} />);

    fireEvent.click(await screen.findByText('Rahul Verma'));
    fireEvent.click(await screen.findByText('Capture Photo'));
    fireEvent.click(await screen.findByText('Use Photo'));
    fireEvent.change(screen.getByLabelText(/Visitor card number/i), { target: { value: 'C-104' } });
    fireEvent.click(await screen.findByText('Check In'));

    await waitFor(() => {
      expect(visitsUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'checked_in',
        carrying_material: false,
        carrying_remarks: null,
      }));
    });
  });

  // A guard who types a list and then unticks the box must not leave orphaned
  // text describing material the visit record says was never carried.
  it('discards remarks if the guard unticks the box before confirming', async () => {
    render(<CheckInPanel today="2026-08-01" onCheckInSuccess={vi.fn()} />);

    fireEvent.click(await screen.findByText('Rahul Verma'));
    fireEvent.click(await screen.findByText('Capture Photo'));
    fireEvent.click(await screen.findByText('Use Photo'));

    const box = await screen.findByLabelText(/Carrying material/i);
    fireEvent.click(box);
    fireEvent.change(screen.getByPlaceholderText(/laptop/i), { target: { value: 'Toolbox' } });
    fireEvent.click(box);
    fireEvent.change(screen.getByLabelText(/Visitor card number/i), { target: { value: 'C-104' } });

    fireEvent.click(await screen.findByText('Check In'));

    await waitFor(() => {
      expect(visitsUpdate).toHaveBeenCalledWith(expect.objectContaining({
        carrying_material: false,
        carrying_remarks: null,
      }));
    });
  });
});
