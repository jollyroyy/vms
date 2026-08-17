// New component (src/pages/Guard/GuardWalkIns.tsx). Every existing test that
// touches it (GuardConsoleModeContent.test.tsx) mocks it out entirely, so its
// own form-toggle and pending-list rendering has never actually been
// exercised. WalkInRequest is mocked here — it has its own coverage in
// WalkInRequestScan.test.tsx — so this file stays focused on what
// GuardWalkIns itself owns: the toggle between the register button, the
// pending-gate-check-in box and the awaiting-approval list.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
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

// No camera stubs are needed: the gate check-in form (WalkInCheckInForm, the
// SAME component on both screens) asks only for the visitor card number since
// 2026-08-17 — the photo and the ID scan happen at registration.
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

function cleared(overrides: Partial<Visit> = {}): Visit {
  return visit({
    id: 'w1',
    status: 'walkin_approved',
    visitor: { ...visit().visitor!, full_name: 'Cleared Person' },
    ...overrides,
  });
}

function baseProps(overrides: Record<string, any> = {}) {
  return {
    loading: false,
    pending: [] as Visit[],
    awaitingCheckIn: [] as Visit[],
    busyId: null as string | null,
    onCheckIn: vi.fn(),
    onSubmitted: vi.fn(),
    ...overrides,
  };
}

describe('GuardWalkIns', () => {
  it('renders the "Register a walk-in" button and no form by default', () => {
    render(<GuardWalkIns {...baseProps()} />);
    expect(screen.getByText('Register a walk-in')).toBeInTheDocument();
    expect(screen.queryByTestId('walk-in-request')).not.toBeInTheDocument();
  });

  it('clicking the register button swaps in the walk-in form', () => {
    render(<GuardWalkIns {...baseProps()} />);
    fireEvent.click(screen.getByText('Register a walk-in'));
    expect(screen.getByTestId('walk-in-request')).toBeInTheDocument();
    expect(screen.queryByText('Register a walk-in')).not.toBeInTheDocument();
  });

  it('submitting the form closes it and forwards the name to onSubmitted', () => {
    const onSubmitted = vi.fn();
    render(<GuardWalkIns {...baseProps({ onSubmitted })} />);
    fireEvent.click(screen.getByText('Register a walk-in'));
    fireEvent.click(screen.getByText('Submit'));

    expect(onSubmitted).toHaveBeenCalledWith('New Visitor');
    expect(screen.queryByTestId('walk-in-request')).not.toBeInTheDocument();
    expect(screen.getByText('Register a walk-in')).toBeInTheDocument();
  });

  it('cancelling the form returns to the register button without calling onSubmitted', () => {
    const onSubmitted = vi.fn();
    render(<GuardWalkIns {...baseProps({ onSubmitted })} />);
    fireEvent.click(screen.getByText('Register a walk-in'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByTestId('walk-in-request')).not.toBeInTheDocument();
    expect(screen.getByText('Register a walk-in')).toBeInTheDocument();
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it('shows the loading skeleton, not the empty state, while loading', () => {
    render(<GuardWalkIns {...baseProps({ loading: true })} />);
    expect(screen.queryByText('Nothing waiting on a person to meet.')).not.toBeInTheDocument();
    expect(screen.queryByText('Nobody is waiting to be checked in.')).not.toBeInTheDocument();
  });

  it('shows the empty state when nothing is pending', () => {
    render(<GuardWalkIns {...baseProps()} />);
    expect(screen.getByText('Nothing waiting on a person to meet.')).toBeInTheDocument();
    // Two boxes, two counts — the approval one and the gate-check-in one.
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('renders one card per pending visit and the count chip matches', () => {
    const pending = [visit({ id: 'a' }), visit({ id: 'b', visitor: { ...visit().visitor!, full_name: 'Second Person' } })];
    render(<GuardWalkIns {...baseProps({ pending })} />);
    expect(screen.getByText('Walk-in Person')).toBeInTheDocument();
    expect(screen.getByText('Second Person')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('Nothing waiting on a person to meet.')).not.toBeInTheDocument();
  });
});

// The client instruction of 2026-08-17: a walk-in the host has cleared must be
// checkable in from the register itself, not only from the Approved Walk-ins
// tab. The count beside the heading is the number of Check In buttons under it
// (the guardTiles.ts rule), and the card number is collected here.
describe('GuardWalkIns — awaiting gate check-in', () => {
  it('names the box and shows its empty state when nobody is cleared', () => {
    render(<GuardWalkIns {...baseProps()} />);
    expect(screen.getByText('Awaiting gate check-in')).toBeInTheDocument();
    expect(screen.getByText('Nobody is waiting to be checked in.')).toBeInTheDocument();
    expect(screen.queryByText('Check In')).not.toBeInTheDocument();
  });

  it('lists each cleared walk-in with a Check In button, and counts them', () => {
    render(<GuardWalkIns {...baseProps({
      awaitingCheckIn: [cleared(), cleared({ id: 'w2', visitor: { ...visit().visitor!, full_name: 'Other Cleared' } })],
    })} />);

    expect(screen.getByText('Cleared Person')).toBeInTheDocument();
    expect(screen.getByText('Other Cleared')).toBeInTheDocument();
    expect(screen.getAllByText('Check In')).toHaveLength(2);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('Nobody is waiting to be checked in.')).not.toBeInTheDocument();
  });

  // The whole point of putting the button here: it must reach the same write,
  // with the card number the gate hands over.
  it('checks a cleared walk-in in on the card number alone', () => {
    const onCheckIn = vi.fn();
    const v = cleared();
    render(<GuardWalkIns {...baseProps({ awaitingCheckIn: [v], onCheckIn })} />);

    fireEvent.click(screen.getByText('Check In'));
    // Neither is asked for again — both were taken at registration.
    expect(screen.queryByText('Photo of the visitor')).not.toBeInTheDocument();
    expect(screen.queryByText('Scan ID card')).not.toBeInTheDocument();

    const confirm = screen.getByText('Confirm Check In');
    expect(confirm).toBeDisabled();
    expect(screen.getByText('Enter the visitor card number before checking in.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Visitor card number/i), { target: { value: 'C-104' } });
    expect(confirm).not.toBeDisabled();

    fireEvent.click(confirm);
    expect(onCheckIn).toHaveBeenCalledTimes(1);
    const [calledVisit, details] = onCheckIn.mock.calls[0];
    expect(calledVisit).toBe(v);
    expect(details).toEqual({ cardNumber: 'C-104', carrying: false, remarks: '' });
  });

  // The open row is held by PendingGateCheckIn, so opening a second row closes
  // the first: one card is handed to one visitor, and two card fields open at
  // once is how the wrong number lands on the wrong row.
  it('opens only one check-in form at a time', () => {
    render(<GuardWalkIns {...baseProps({
      awaitingCheckIn: [cleared(), cleared({ id: 'w2', visitor: { ...visit().visitor!, full_name: 'Other Cleared' } })],
    })} />);

    fireEvent.click(screen.getAllByText('Check In')[0]);
    expect(screen.getAllByLabelText(/Visitor card number/i)).toHaveLength(1);

    fireEvent.click(screen.getByText('Check In'));
    expect(screen.getAllByLabelText(/Visitor card number/i)).toHaveLength(1);
    expect(screen.getAllByText('Confirm Check In')).toHaveLength(1);
  });

  // The register still watches undecided requests; the two boxes must not be
  // one list. A row waiting on the host has no Check In button.
  it('keeps the undecided requests in their own box, with no Check In button', () => {
    render(<GuardWalkIns {...baseProps({ pending: [visit()], awaitingCheckIn: [cleared()] })} />);

    const approvalHeading = screen.getByText('Awaiting host approval');
    const approvalBox = approvalHeading.closest('div')!.parentElement!;
    expect(within(approvalBox).getByText('Walk-in Person')).toBeInTheDocument();
    expect(within(approvalBox).queryByText('Check In')).not.toBeInTheDocument();
    expect(screen.getAllByText('Check In')).toHaveLength(1);
  });

  // The two waits are stacked in the order they happen (client instruction,
  // 2026-08-17): the host answers first, the gate lets them in second, so a row
  // crossing from one to the other moves one box DOWN rather than jumping the
  // page. Asserted on document order, not on styling.
  it('puts "Awaiting host approval" above "Awaiting gate check-in"', () => {
    render(<GuardWalkIns {...baseProps()} />);
    const host = screen.getByText('Awaiting host approval');
    const gate = screen.getByText('Awaiting gate check-in');
    expect(host.compareDocumentPosition(gate) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
