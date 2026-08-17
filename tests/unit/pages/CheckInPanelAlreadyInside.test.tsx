// A visitor who is already inside cannot check in again until they check out.
//
// Enforced for real by migration 060 (partial unique index on
// visits(visitor_id) where status = 'checked_in'); this file covers the
// guard-facing half — that the console refuses the check-in and says who is
// already inside instead of writing a second open visit.

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { freezeIstClock, unfreezeIstClock } from '../helpers/istClock';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import CheckInPanel from '../../../src/pages/Guard/CheckInPanel';

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
// The check-in write reads its own row back — `.update(...).eq(...)
// .select('id, host_id').maybeSingle()` — so the host can be notified that
// their visitor is inside. The mock mirrors that whole chain; stopping at
// `.eq()` makes the write resolve to undefined and swallows the error branch.
const updateResult = vi.hoisted(() => ({ current: { data: { id: 'v1', host_id: 'h1' }, error: null } as any }));
const visitsUpdate = vi.hoisted(() => vi.fn(() => ({
  eq: vi.fn(() => ({
    select: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve(updateResult.current)) })),
  })),
})));
const alreadyInside = vi.hoisted(() => ({ current: [] as any[] }));

// The ID scan is mandatory on every check-in path since 2026-08-17, so reaching
// an enabled Check In means satisfying it. What the scan itself reads is
// CheckInPhotoStepScan.test.tsx's subject; here it is a stub.
vi.mock('../../../src/pages/Guard/IdScanOverlay', () => ({
  default: (props: any) => (
    <button onClick={() => props.onScanned({ idType: 'PAN', idLast4: '234F', name: 'Rahul Verma' })}>
      ID SCAN STUB
    </button>
  ),
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://cdn/s.jpg' }, error: null }),
      }),
    },
  },
}));

vi.mock('../../../src/lib/useCameraStream', () => ({
  useCameraStream: () => ({ status: 'streaming', errorMessage: '', start: vi.fn(), stop: vi.fn() }),
}));

const mockDepts = [{ id: 'dept-it', name: 'Information Technology', code: 'IT', created_at: '2026-01-01' }];

const visit = {
  id: 'v1', visitor_id: 'vis1', status: 'approved', purpose: 'meeting',
  created_at: new Date().toISOString(), scheduled_for: null, host_id: 'h1', photo_data: null,
  visitor: { id: 'vis1', full_name: 'Rahul Verma', phone: '9876543210', vendor_name: null },
  department: mockDepts[0],
};

beforeEach(() => {
  // Frozen at midday IST. These fixtures are anchored to "today", and since
  // migration 075 ended the IST day at 22:00 they stop being due today for the
  // last two hours of every real day — the suite used to pass all day and fail
  // each evening. See tests/unit/helpers/istClock.ts.
  freezeIstClock();
  vi.stubEnv('VITE_FEATURE_OCR', 'false');
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 1280 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 720 });
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) { cb(new Blob(['f'], { type: 'image/jpeg' })); };
  HTMLCanvasElement.prototype.getContext = function () { return { drawImage: vi.fn() } as any; };
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

  mockRpc.mockImplementation((name: string) =>
    name === 'get_profile_names'
      ? Promise.resolve({ data: [{ id: 'h1', full_name: 'Priya Sharma', role: 'hod' }], error: null })
      : Promise.resolve({ data: null, error: null }));

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
          // Carries the blacklist columns: checkInScannedVisit reads the
          // watchlist flag off this same lookup.
          if (cols.startsWith('visitor_id')) {
            return { eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { visitor_id: 'vis1', visitor: { is_blacklisted: false, blacklist_reason: null } }, error: null }) }) };
          }
          if (cols.includes('visitor:visitors!inner')) {
            const chain: any = {
              eq: () => chain,
              limit: () => Promise.resolve({ data: alreadyInside.current, error: null }),
            };
            return chain;
          }
          return { in: () => ({ order: () => Promise.resolve({ data: [visit], error: null }) }) };
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
        update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })),
        upsert: vi.fn(() => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'vis1' }, error: null }) }) })),
      };
    }
    if (table === 'audit_logs') {
      return { select: () => ({ eq: () => ({ in: () => ({ in: () => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }) }) };
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
  updateResult.current = { data: { id: 'v1', host_id: 'h1' }, error: null };
  visitsUpdate.mockClear();
});

/** Walks the console to the confirm step for the seeded pre-approved visitor. */
async function reachConfirmStep() {
  render(<CheckInPanel today="2026-08-01" onCheckInSuccess={vi.fn()} />);
  fireEvent.click(await screen.findByText('Rahul Verma'));
  fireEvent.click(await screen.findByText('Capture Photo'));
  fireEvent.click(await screen.findByText('Use Photo'));
  fireEvent.change(screen.getByLabelText(/Visitor card number/i), { target: { value: 'C-104' } });
  fireEvent.click(screen.getByText('Scan ID card'));
  fireEvent.click(screen.getByText('ID SCAN STUB'));
}

describe('CheckInPanel — already inside', () => {
  it('refuses the check-in when that mobile number is already inside', async () => {
    alreadyInside.current = [{
      id: 'open-1',
      checked_in_at: '2026-08-01T09:15:00Z',
      visitor: { full_name: 'Rahul Verma', phone: '9876543210', id_type: 'PAN', id_last4: '234F' },
    }];
    await reachConfirmStep();
    fireEvent.click(await screen.findByText('Check In'));

    await waitFor(() => {
      expect(screen.getByText(/already inside/i)).toBeInTheDocument();
    });
    expect(visitsUpdate).not.toHaveBeenCalled();
  });

  it('names the person and their number so the guard can go and find them', async () => {
    alreadyInside.current = [{
      id: 'open-1',
      checked_in_at: '2026-08-01T09:15:00Z',
      visitor: { full_name: 'Rahul Verma', phone: '9876543210', id_type: null, id_last4: null },
    }];
    await reachConfirmStep();
    fireEvent.click(await screen.findByText('Check In'));

    await waitFor(() => {
      const msg = screen.getByText(/already inside/i).textContent ?? '';
      expect(msg).toContain('Rahul Verma');
      expect(msg).toContain('9876543210');
      expect(msg).toMatch(/check them out/i);
    });
  });

  it('checks in normally when nobody with that number is inside', async () => {
    alreadyInside.current = [];
    await reachConfirmStep();
    fireEvent.click(await screen.findByText('Check In'));

    await waitFor(() => {
      expect(visitsUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'checked_in' }));
    });
  });

  // The race the pre-check cannot close: another device checked the same
  // visitor in between our lookup and our write. The DB index catches it and
  // the guard must still get a sentence, not a raw 23505.
  it('translates the database constraint violation into a readable message', async () => {
    updateResult.current = {
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "visits_one_open_per_visitor"',
      },
    };

    await reachConfirmStep();
    fireEvent.click(await screen.findByText('Check In'));

    await waitFor(() => {
      expect(screen.getByText(/already inside/i)).toBeInTheDocument();
    });
  });
});
