import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { freezeIstClock, unfreezeIstClock } from '../helpers/istClock';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GuardConsole from '../../../src/pages/Guard/Console';

const mockVisitData = vi.hoisted(() => ({ current: [] as any[] }));
const orCalls = vi.hoisted(() => ({ current: [] as string[] }));

vi.mock('../../../src/pages/Guard/CheckInPanel', () => ({
  default: () => <div>CheckInPanel</div>,
}));

vi.mock('../../../src/supabaseClient', () => {
  const ch: any = {};
  ch.on = () => ch;
  ch.subscribe = () => ch;
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          or: vi.fn((filters: string) => {
            orCalls.current.push(filters);
            return {
              order: vi.fn(() => Promise.resolve({ data: mockVisitData.current, error: null })),
            };
          }),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
      channel: vi.fn(() => ch),
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: (rows: any[]) => Promise.resolve(rows),
}));

beforeEach(() => {
  // Frozen at midday IST. These fixtures are anchored to "today", and since
  // migration 075 ended the IST day at 22:00 they stop being due today for the
  // last two hours of every real day — the suite used to pass all day and fail
  // each evening. See tests/unit/helpers/istClock.ts.
  freezeIstClock();
});

afterEach(() => {
  unfreezeIstClock();
  cleanup();
  vi.restoreAllMocks();
  mockVisitData.current = [];
  orCalls.current = [];
});

/** Today in IST, so fixtures land on the day the page considers current. The
 *  page uses istDateKey, not the UTC date — between 00:00 and 05:30 IST those
 *  are different days and a UTC-built fixture would silently be "yesterday". */
function istToday(): string {
  const ist = new Date(Date.now() + (5 * 60 + 30) * 60_000);
  return ist.toISOString().slice(0, 10);
}

function visit(overrides: Record<string, any> = {}) {
  return {
    id: 'v1',
    ref_number: 'VIS-0001',
    status: 'checked_in',
    purpose: 'meeting',
    created_at: `${istToday()}T04:00:00Z`,
    checked_in_at: `${istToday()}T04:05:00Z`,
    checked_out_at: null,
    scheduled_for: null,
    photo_data: null,
    visitor: { full_name: 'Alice Johnson', phone: '9876543210', vendor_name: 'Acme' },
    department: { name: 'Engineering' },
    ...overrides,
  };
}

// The page reads its segment from the URL, so every render goes through a real
// route — rendering the component bare would silently always test "all".
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/visitors" element={<GuardConsole />} />
        <Route path="/visitors/:segment" element={<GuardConsole />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GuardConsole segments', () => {
  it('defaults to All Visitors at the bare /visitors route', async () => {
    renderAt('/visitors');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('All Visitors');
    });
  });

  // Each segment is a real URL now, not a tab hidden inside the page. That is
  // what makes them bookmarkable and the back button work between them.
  it.each([
    ['/visitors/inside', 'Inside'],
    ['/visitors/pending', 'Pending Approval'],
    // The Checked Out and Expected segments were both removed 2026-08-15
    // (client instruction); their old URLs degrade onto All rather than
    // 404-ing. A visitor booked for today who has not arrived is the
    // Pre-Registered tab's subject now, which can act on them.
    ['/visitors/checked-out', 'All Visitors'],
    ['/visitors/expected', 'All Visitors'],
  ])('%s renders the %s heading', async (path, heading) => {
    renderAt(path);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
    });
  });

  // The Visitors tab only shows which visitor falls under which category —
  // client instruction, 2026-08-14. Check-out happens on the Inside Now tab
  // (/guard/inside-now); a card in a category list never carries an action.
  it('lists a checked-in visitor under Inside, with no check-out action', async () => {
    mockVisitData.current = [visit()];
    renderAt('/visitors/inside');
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Check Out/i })).not.toBeInTheDocument();
  });

  // The visitors grid never starts a check-in either — entry is the Scan Pass
  // and Pre-Approvals desks. No button on any card, whatever the status.
  // /visitors/expected degrades onto `all` (the segment was removed
  // 2026-08-15), so this still exercises an approved-not-yet-arrived visitor.
  it('offers no Check In and no Check Out on an expected visitor', async () => {
    mockVisitData.current = [visit({
      id: 'v2', status: 'approved', checked_in_at: null,
      scheduled_for: `${istToday()}T05:00:00Z`,
    })];
    renderAt('/visitors/expected');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Check In/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check Out/i })).not.toBeInTheDocument();
  });

  // A visit awaiting an HOD's decision has nothing the guard can do to it. A
  // button they cannot honour is worse than no button — and there are no
  // buttons here at all.
  it('offers no action on a visit still pending approval', async () => {
    mockVisitData.current = [visit({ id: 'v3', status: 'pending_approval', checked_in_at: null })];
    renderAt('/visitors/pending');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^Check In$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check Out/i })).not.toBeInTheDocument();
  });

  it('shows the segment empty state when nothing matches', async () => {
    mockVisitData.current = [];
    renderAt('/visitors/inside');
    await waitFor(() => {
      expect(screen.getByText('No one is inside right now.')).toBeInTheDocument();
    });
  });

  // The walk-in register is untouched by the nav restructure: a guard still has
  // to be able to register someone who turned up unannounced, and that flow is
  // the one thing on this surface that CREATES a visit rather than advancing one.
  it('the walk-in segment still renders the registration lane', async () => {
    renderAt('/visitors/walk-in');
    await waitFor(() => {
      expect(screen.getByText('Register a walk-in')).toBeInTheDocument();
      expect(screen.getByText('Awaiting host approval')).toBeInTheDocument();
    });
  });

  it('the approved segment renders the walk-in check-in flow', async () => {
    mockVisitData.current = [visit({ id: 'v4', status: 'walkin_approved', checked_in_at: null })];
    renderAt('/visitors/approved');
    await waitFor(() => {
      expect(screen.getByText('Awaiting gate check-in')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
  });

  // Old bookmarks and old dashboard tiles carry these slugs. None may 404 into
  // a blank page — segmentFromSlug degrades every one onto a live segment.
  describe('legacy slugs degrade onto a live segment', () => {
    it.each([
      ['walkins', 'Walk-in Visitors'],
      ['walkin-approved', 'Approved Walk-ins'],
      // The Expected segment was removed 2026-08-15; `checkin` now degrades
      // onto All, same as `expected` and `checked-out`.
      ['checkin', 'All Visitors'],
      ['exit', 'Inside'],
      ['rejected', 'All Visitors'],
      ['all', 'All Visitors'],
      ['no-show', 'All Visitors'],
      ['nonsense-not-a-segment', 'All Visitors'],
    ])('/visitors/%s renders %s', async (slug, heading) => {
      renderAt(`/visitors/${slug}`);
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
      });
    });
  });

  // Guards against the load window silently narrowing back to "today only",
  // which used to drop a walk-in registered at 23:50 and approved at 00:05, and
  // a visitor still inside from the previous evening. `approved` is in the list
  // because without it the ordinary case — booked yesterday, arriving today —
  // never loaded at all.
  it('loads today\'s window plus every open status, unbounded', async () => {
    renderAt('/visitors');
    await waitFor(() => expect(orCalls.current.length).toBeGreaterThan(0));
    expect(orCalls.current[0]).toContain('created_at.gte.');
    expect(orCalls.current[0]).toContain('status.in.(pending_approval,approved,walkin_approved,checked_in)');
  });

  // CheckInPanel lives on /guard/pre-approvals and the Scan Pass lane. This
  // page resolves visitors from a list it already loaded, so the panel's search
  // desk has no job here.
  it('never renders CheckInPanel, in any segment', async () => {
    for (const path of ['/visitors', '/visitors/expected', '/visitors/inside', '/visitors/walk-in']) {
      renderAt(path);
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
      expect(screen.queryByText('CheckInPanel')).not.toBeInTheDocument();
      cleanup();
    }
  });

  // The console must never let a guard mint an entry pass. See the comment
  // block at the top of Console.tsx and canRoleShowPass in lib/passVisibility.ts.
  it('never offers an entry pass, badge or QR', async () => {
    mockVisitData.current = [visit()];
    const { container } = renderAt('/visitors/inside');
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());
    expect(screen.queryByText(/print badge/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/visitor pass/i)).not.toBeInTheDocument();
    expect(container.querySelector('img[alt*="QR" i]')).toBeNull();
  });
});
