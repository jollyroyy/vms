// New component (src/pages/Guard/GuardWalkIns.tsx). Every existing test that
// touches it (GuardConsoleModeContent.test.tsx) mocks it out entirely, so its
// own form-toggle and pending-list rendering has never actually been
// exercised. WalkInRequest is mocked here — it has its own coverage in
// WalkInRequestScan.test.tsx — so this file stays focused on what
// GuardWalkIns itself owns: the toggle between the register button and the
// form, and the awaiting-approval list.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import GuardWalkIns from '../../../src/pages/Guard/GuardWalkIns';
import type { Visit } from '../../../src/types/index';

vi.mock('../../../src/pages/Guard/WalkInRequest', () => ({
  default: ({ onSubmitted, onCancel }: { onSubmitted: (name: string) => void; onCancel: () => void }) => (
    <div data-testid="walk-in-request">
      <button type="button" onClick={() => onSubmitted('New Visitor')}>Submit</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

afterEach(cleanup);

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1', ref_number: 'VIS-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    purpose: 'meeting', photo_path: null, photo_data: null, status: 'pending_approval',
    checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
    carrying_material: false, scheduled_for: null, qr_token: 't', qr_expires_at: null,
    created_at: '2026-08-03T04:00:00Z',
    visitor: { id: 'p1', phone: '9876543210', full_name: 'Walk-in Person', vendor_name: null,
      id_type: 'Aadhaar', id_last4: '1234', vehicle_number: null,
      is_blacklisted: false, blacklist_reason: null, created_at: '2026-01-01T00:00:00Z' },
    ...overrides,
  } as Visit;
}

describe('GuardWalkIns', () => {
  it('renders the "Register a walk-in" button and no form by default', () => {
    render(<GuardWalkIns loading={false} pending={[]} onSubmitted={vi.fn()} />);
    expect(screen.getByText('Register a walk-in')).toBeInTheDocument();
    expect(screen.queryByTestId('walk-in-request')).not.toBeInTheDocument();
  });

  it('clicking the register button swaps in the walk-in form', () => {
    render(<GuardWalkIns loading={false} pending={[]} onSubmitted={vi.fn()} />);
    fireEvent.click(screen.getByText('Register a walk-in'));
    expect(screen.getByTestId('walk-in-request')).toBeInTheDocument();
    expect(screen.queryByText('Register a walk-in')).not.toBeInTheDocument();
  });

  it('submitting the form closes it and forwards the name to onSubmitted', () => {
    const onSubmitted = vi.fn();
    render(<GuardWalkIns loading={false} pending={[]} onSubmitted={onSubmitted} />);
    fireEvent.click(screen.getByText('Register a walk-in'));
    fireEvent.click(screen.getByText('Submit'));

    expect(onSubmitted).toHaveBeenCalledWith('New Visitor');
    expect(screen.queryByTestId('walk-in-request')).not.toBeInTheDocument();
    expect(screen.getByText('Register a walk-in')).toBeInTheDocument();
  });

  it('cancelling the form returns to the register button without calling onSubmitted', () => {
    const onSubmitted = vi.fn();
    render(<GuardWalkIns loading={false} pending={[]} onSubmitted={onSubmitted} />);
    fireEvent.click(screen.getByText('Register a walk-in'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByTestId('walk-in-request')).not.toBeInTheDocument();
    expect(screen.getByText('Register a walk-in')).toBeInTheDocument();
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it('shows the loading skeleton, not the empty state, while loading', () => {
    render(<GuardWalkIns loading pending={[]} onSubmitted={vi.fn()} />);
    expect(screen.queryByText('Nothing waiting on a person to meet.')).not.toBeInTheDocument();
  });

  it('shows the empty state when nothing is pending', () => {
    render(<GuardWalkIns loading={false} pending={[]} onSubmitted={vi.fn()} />);
    expect(screen.getByText('Nothing waiting on a person to meet.')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders one card per pending visit and the count chip matches', () => {
    const pending = [visit({ id: 'a' }), visit({ id: 'b', visitor: { ...visit().visitor!, full_name: 'Second Person' } })];
    render(<GuardWalkIns loading={false} pending={pending} onSubmitted={vi.fn()} />);
    expect(screen.getByText('Walk-in Person')).toBeInTheDocument();
    expect(screen.getByText('Second Person')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('Nothing waiting on a person to meet.')).not.toBeInTheDocument();
  });
});
