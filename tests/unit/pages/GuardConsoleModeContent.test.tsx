import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import GuardConsoleModeContent from '../../../src/pages/Guard/GuardConsoleModeContent';
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

  it('shows the "inside" empty state when given no rows', () => {
    const props = baseProps({ mode: 'inside', checkedIn: [] });
    render(<GuardConsoleModeContent {...props} />);
    expect(screen.getByText('No one is inside right now.')).toBeInTheDocument();
  });

  it('mode="expected" renders CheckInPanel', () => {
    const props = baseProps({ mode: 'expected' });
    render(<GuardConsoleModeContent {...props} />);
    expect(screen.getByText('CheckInPanel')).toBeInTheDocument();
  });

  it('mode="walkins" renders GuardWalkIns', () => {
    const props = baseProps({ mode: 'walkins' });
    render(<GuardConsoleModeContent {...props} />);
    expect(screen.getByText('GuardWalkIns')).toBeInTheDocument();
  });
});
