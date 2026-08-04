import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import GuardConsoleModeContent from '../../../src/pages/Guard/GuardConsoleModeContent';
import { formatDateTime } from '../../../src/lib/formatDate';
import type { Visit } from '../../../src/types/index';

vi.mock('../../../src/pages/Guard/CheckInPanel', () => ({
  default: () => <div>CheckInPanel</div>,
}));

vi.mock('../../../src/pages/Guard/GuardWalkIns', () => ({
  default: () => <div>GuardWalkIns</div>,
}));

afterEach(() => cleanup());

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    status: 'checked_in',
    created_at: '2026-08-02T04:00:00Z',
    checked_in_at: '2026-08-02T04:05:00Z',
    checked_out_at: null,
    photo_data: null,
    visitor: { full_name: 'Alice Johnson' } as any,
    department: { name: 'Engineering' } as any,
    ...overrides,
  } as unknown as Visit;
}

function baseProps(overrides: Record<string, any> = {}) {
  return {
    mode: 'inside' as const,
    today: '2026-08-02',
    onCheckInSuccess: vi.fn(),
    loading: false,
    checkedIn: [] as Visit[],
    pendingWalkIns: [] as Visit[],
    approvedWalkIns: [] as Visit[],
    busyId: null as string | null,
    onCheckIn: vi.fn(),
    onCheckOut: vi.fn(),
    ...overrides,
  };
}

describe('GuardConsoleModeContent', () => {
  it('mode="inside" renders a Check Out action that fires onCheckOut with the visit', () => {
    const v = visit();
    const onCheckOut = vi.fn();
    const props = baseProps({ mode: 'inside', checkedIn: [v], onCheckOut });
    render(<GuardConsoleModeContent {...props} />);

    expect(screen.getByText('On the premises')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Check Out'));
    expect(onCheckOut).toHaveBeenCalledWith(v);
  });

  // The audit list views (checked-out / rejected / all) were removed from the
  // guard surface entirely. LIST_VIEWS no longer has entries for them, so an
  // unrecognised mode must render nothing rather than fall back to a stale view.
  it('an unrecognised mode (e.g. a removed audit view) renders null', () => {
    const props = baseProps({ mode: 'checked-out' as any });
    const { container } = render(<GuardConsoleModeContent {...props} />);
    expect(container).toBeEmptyDOMElement();
  });

  // The inside list is no longer today-only (see the .or() window change in
  // Console.tsx), so a bare "08:15" could not be told from yesterday's 08:15.
  // Rows must carry the date alongside the time.
  it('mode="inside" shows the check-in time WITH its date, not time alone', () => {
    const v = visit({ checked_in_at: '2026-08-02T04:05:00Z' });
    const props = baseProps({ mode: 'inside', checkedIn: [v] });
    render(<GuardConsoleModeContent {...props} />);
    expect(screen.getByText(formatDateTime(v.checked_in_at))).toBeInTheDocument();
  });

  it('shows the "inside" empty state when given no rows', () => {
    const props = baseProps({ mode: 'inside', checkedIn: [] });
    render(<GuardConsoleModeContent {...props} />);
    expect(screen.getByText('No one is inside right now.')).toBeInTheDocument();
  });

  // CheckInPanel moved out of here and up into Console.tsx, where it renders
  // unconditionally above the tab bar. This component now only serves lists.
  it('never renders CheckInPanel, whichever mode it is given', () => {
    (['inside', 'walkins', 'walkinApproved', 'expected'] as any[]).forEach((mode) => {
      const { unmount } = render(<GuardConsoleModeContent {...baseProps({ mode })} />);
      expect(screen.queryByText('CheckInPanel')).not.toBeInTheDocument();
      unmount();
    });
  });

  it('mode="walkins" renders GuardWalkIns', () => {
    const props = baseProps({ mode: 'walkins' });
    render(<GuardConsoleModeContent {...props} />);
    expect(screen.getByText('GuardWalkIns')).toBeInTheDocument();
  });

  // "Approved" is the route into checked_in for a walk-in the host said yes
  // to — CheckInPanel moved to /guard/pre-approvals and no longer covers it.
  it('mode="walkinApproved" renders the approved walk-in list', () => {
    const v = visit({ id: 'v9', status: 'walkin_approved', visitor: { full_name: 'Approved Guy' } as any });
    const props = baseProps({ mode: 'walkinApproved', approvedWalkIns: [v] });
    render(<GuardConsoleModeContent {...props} />);
    expect(screen.getByText('Approved, waiting to enter')).toBeInTheDocument();
    expect(screen.getByText('Approved Guy')).toBeInTheDocument();
  });

  it('mode="walkinApproved" shows its own empty state when there are none', () => {
    const props = baseProps({ mode: 'walkinApproved', approvedWalkIns: [] });
    render(<GuardConsoleModeContent {...props} />);
    expect(screen.getByText('No approved walk-ins waiting.')).toBeInTheDocument();
  });
});
