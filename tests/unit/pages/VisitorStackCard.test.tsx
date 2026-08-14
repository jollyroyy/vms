import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import VisitorStackCard from '../../../src/pages/Guard/VisitorStackCard';

afterEach(cleanup);

function visit(overrides: Record<string, any> = {}): any {
  return {
    id: 'v1',
    ref_number: 'VIS-20260813-0001',
    status: 'approved',
    purpose: 'meeting',
    created_at: '2026-08-13T04:00:00Z',
    checked_in_at: null,
    checked_out_at: null,
    scheduled_for: '2026-08-13T04:30:00Z',
    expected_departure: null,
    photo_data: null,
    visitor: {
      full_name: 'Rahul Sharma',
      phone: '9876543210',
      vendor_name: 'Acme Technologies',
      id_type: 'Aadhaar',
      id_last4: '4321',
      vehicle_number: 'KA 01 AB 1234',
    },
    host: { full_name: 'Priya Menon' },
    department: { name: 'HR' },
    ...overrides,
  };
}

describe('VisitorStackCard', () => {
  it('leads with the visitor, then the vendor', () => {
    render(<VisitorStackCard visit={visit()} />);
    expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
    expect(screen.getByText('Acme Technologies')).toBeInTheDocument();
  });

  // CLAUDE.md forbids rendering the same value twice in one card. The vendor
  // and the host each have exactly one home on this card.
  it('renders the vendor and the host exactly once each', () => {
    render(<VisitorStackCard visit={visit()} />);
    expect(screen.getAllByText('Acme Technologies')).toHaveLength(1);
    expect(screen.getAllByText('Priya Menon')).toHaveLength(1);
  });

  // CLAUDE.md forbids rendering the same value twice in one card. The
  // department used to trail the host's name in brackets AND own a row below.
  it('renders the department exactly once, not beside the host name', () => {
    render(<VisitorStackCard visit={visit()} />);
    expect(screen.getAllByText('HR')).toHaveLength(1);
    expect(screen.queryByText(/\(HR\)/)).not.toBeInTheDocument();
  });

  it('shows the contact number', () => {
    render(<VisitorStackCard visit={visit()} />);
    expect(screen.getByText('9876543210')).toBeInTheDocument();
  });

  // Vehicle registration removed per client instruction (no driver/vehicle
  // management in this mall deployment) — guard against it creeping back in.
  it('renders no vehicle fact on the card', () => {
    render(<VisitorStackCard visit={visit()} />);
    expect(screen.queryByText(/vehicle/i)).not.toBeInTheDocument();
  });

  // Which time is shown depends on where the visit is. "Expected Time" beside
  // someone already inside answers a question nobody is asking.
  it('shows Expected Time before arrival and Checked In after', () => {
    const { unmount } = render(<VisitorStackCard visit={visit()} />);
    expect(screen.getByText('Expected Time')).toBeInTheDocument();
    expect(screen.queryByText('Checked In')).not.toBeInTheDocument();
    unmount();

    render(<VisitorStackCard visit={visit({ status: 'checked_in', checked_in_at: '2026-08-13T04:35:00Z' })} />);
    expect(screen.getByText('Checked In')).toBeInTheDocument();
    expect(screen.queryByText('Expected Time')).not.toBeInTheDocument();
  });

  // Optional on purpose (migration 073) — only render the deadline the
  // approver actually set, never a fabricated one.
  it('shows Due Out only when an expected departure was set', () => {
    const inside = { status: 'checked_in', checked_in_at: '2026-08-13T04:35:00Z' };
    const { unmount } = render(<VisitorStackCard visit={visit(inside)} />);
    expect(screen.queryByText('Due Out')).not.toBeInTheDocument();
    unmount();

    render(<VisitorStackCard visit={visit({ ...inside, expected_departure: '2026-08-15T12:00:00Z' })} />);
    expect(screen.getByText('Due Out')).toBeInTheDocument();
  });

  // Status is carried by a text badge as well as the colour rail. A gate
  // terminal is read in glare, and colour-only encoding fails colour-blind
  // guards too — so the words must be present.
  it('carries the status as words, not colour alone', () => {
    render(<VisitorStackCard visit={visit()} />);
    expect(screen.getByText('Pre-approved')).toBeInTheDocument();
  });

  // The leading colour rail was removed on the client's instruction
  // (2026-08-13). The text badge above is what carries the status, and it is
  // enough on its own — the rule was never "must have a rail", it was "colour
  // must never be the only carrier". Guard the absence so it does not creep
  // back in from the older .visitor-card, which keeps its own rail.
  it('renders no colour rail down the leading edge', () => {
    const { container } = render(<VisitorStackCard visit={visit({ status: 'checked_in' })} />);
    const card = container.querySelector('.stack-card') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.className).not.toMatch(/rail-/);
    expect(container.querySelector('[class*="rail-"]')).toBeNull();
  });

  // Once someone is inside, the status badge no longer says which desk they
  // came through — `checked_in` is the same value on both routes — so the card
  // states it outright. See lib/visitOrigin.ts for why this is inferred.
  it('names the visitor type once the visitor is inside', () => {
    const { unmount } = render(<VisitorStackCard visit={visit({
      status: 'checked_in', checked_in_at: '2026-08-13T04:35:00Z', scheduled_for: '2026-08-13T04:30:00Z',
    })} />);
    expect(screen.getByText('Type: Pre-approved')).toBeInTheDocument();
    unmount();

    render(<VisitorStackCard visit={visit({
      status: 'checked_in', checked_in_at: '2026-08-13T04:35:00Z', scheduled_for: null,
    })} />);
    expect(screen.getByText('Type: Walk-in')).toBeInTheDocument();
  });

  // Before arrival the badge already says it ("Pre-approved" / "Awaiting
  // approval"), and CLAUDE.md forbids rendering the same fact twice on a card.
  it('does not repeat the visitor type before the visitor is inside', () => {
    render(<VisitorStackCard visit={visit()} />);
    expect(screen.queryByText(/^Type:/)).toBeNull();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  // The type and the ID proof are read as one glance — who this person is on
  // paper — so the type must sit directly above the ID line, not elsewhere.
  it('puts the ID proof directly below the visitor type', () => {
    const { container } = render(<VisitorStackCard visit={visit({
      status: 'checked_in', checked_in_at: '2026-08-13T04:35:00Z',
    })} />);
    const rows = Array.from(container.querySelectorAll('.stack-origin, .stack-check'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toMatch(/^Type:/);
    expect(rows[1].textContent).toMatch(/^ID Proof:/);
  });

  it('states an ID proof when one was captured, and says so when not', () => {
    const { unmount } = render(<VisitorStackCard visit={visit()} />);
    expect(screen.getByText(/ID Proof: Aadhaar/)).toBeInTheDocument();
    unmount();

    render(<VisitorStackCard visit={visit({ visitor: { ...visit().visitor, id_type: null } })} />);
    expect(screen.getByText('ID Proof: not captured')).toBeInTheDocument();
  });

  // The card is a check-in record with one purpose: coming back at check-out.
  // It is shown only while the visitor is inside — the one moment the guard
  // needs to know which card to collect at the door.
  it('shows the card number only while inside and only when one is on record', () => {
    const { unmount } = render(<VisitorStackCard visit={visit({
      status: 'checked_in', checked_in_at: '2026-08-13T04:35:00Z', visitor_card_number: 'C-104',
    })} />);
    expect(screen.getByText('Card: C-104')).toBeInTheDocument();
    unmount();

    render(<VisitorStackCard visit={visit({
      status: 'checked_in', checked_in_at: '2026-08-13T04:35:00Z',
    })} />);
    expect(screen.queryByText(/^Card:/)).not.toBeInTheDocument();
  });

  it('renders the primary action and fires it on click', () => {
    const onClick = vi.fn();
    render(<VisitorStackCard visit={visit()} action={{ label: 'Check In', onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: /Check In/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders no action button when the visit offers none', () => {
    render(<VisitorStackCard visit={visit({ status: 'pending_approval' })} />);
    expect(screen.queryByRole('button', { name: /Check In/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check Out/i })).not.toBeInTheDocument();
  });

  it('honours a disabled action', () => {
    const onClick = vi.fn();
    render(<VisitorStackCard visit={visit()} action={{ label: 'Check In', onClick, disabled: true }} />);
    expect(screen.getByRole('button', { name: /Check In/i })).toBeDisabled();
  });

  // The card carries NO Details control (client instruction, 2026-08-13). Every
  // fact a guard acts on is on the card's face; the detail sheet was a second
  // place to read the same visit. The only button a card may hold is the one
  // that advances the visit — Check In or Check Out — so a card with no action
  // has no buttons at all.
  it('renders no Details control, and no button at all when there is no action', () => {
    const { container } = render(<VisitorStackCard visit={visit({ status: 'checked_out' })} />);
    expect(screen.queryByText(/details/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('leaves the action button as the only control when there is one', () => {
    const { container } = render(
      <VisitorStackCard visit={visit()} action={{ label: 'Check In', onClick: vi.fn() }} />,
    );
    expect(screen.queryByText(/details/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  // A guard must never be able to mint an entry pass from a visitor row.
  // See canRoleShowPass in lib/passVisibility.ts.
  it('never renders a badge, pass or QR', () => {
    const { container } = render(<VisitorStackCard visit={visit()} />);
    expect(screen.queryByText(/print badge/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/visitor pass/i)).not.toBeInTheDocument();
    expect(container.querySelector('img[alt*="QR" i]')).toBeNull();
  });

  it('falls back to a placeholder when there is no photo', () => {
    render(<VisitorStackCard visit={visit()} />);
    expect(screen.getByText('No photo')).toBeInTheDocument();
  });
});
