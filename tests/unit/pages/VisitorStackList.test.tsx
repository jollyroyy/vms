// The stacked list shell every listing segment of /visitors renders through.
// It had no test file of its own until the toolbar was removed from it
// (2026-08-13, client instruction) — this file exists mainly so that removal
// cannot quietly come back, and covers the shell's own rendering while it is
// here.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import VisitorStackList from '../../../src/pages/Guard/VisitorStackList';
import { SEGMENT_META } from '../../../src/lib/visitorSegments';
import type { Visit } from '../../../src/types/index';

afterEach(cleanup);

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1', ref_number: 'VIS-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    purpose: 'meeting', photo_path: null, photo_data: null, status: 'checked_in',
    checked_in_at: '2026-08-13T04:00:00Z', checked_out_at: null, exit_verified: null,
    rejection_reason: null, carrying_material: false, scheduled_for: null,
    qr_token: 't', qr_expires_at: null, created_at: '2026-08-13T03:00:00Z',
    visitor: {
      id: 'p1', phone: '9876543210', full_name: 'Alice Johnson', vendor_name: null,
      id_type: 'Aadhaar', id_last4: '1234', vehicle_number: null,
      is_blacklisted: false, blacklist_reason: null, created_at: '2026-01-01T00:00:00Z',
    },
    ...overrides,
  } as Visit;
}

describe('VisitorStackList', () => {
  it('renders the segment heading, subtitle and live count', () => {
    render(<VisitorStackList segment="inside" visits={[visit(), visit({ id: 'v2' })]} loading={false} />);
    expect(screen.getByRole('heading', { name: SEGMENT_META.inside.title })).toBeInTheDocument();
    expect(screen.getByText(SEGMENT_META.inside.subtitle)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows the segment empty copy when there is nothing to list', () => {
    render(<VisitorStackList segment="inside" visits={[]} loading={false} />);
    expect(screen.getByText(SEGMENT_META.inside.empty)).toBeInTheDocument();
  });

  it('renders one card per visit', () => {
    render(
      <VisitorStackList segment="inside" loading={false}
        visits={[visit(), visit({ id: 'v2', ref_number: 'VIS-2' })]} />,
    );
    expect(screen.getAllByText('Alice Johnson')).toHaveLength(2);
  });

  // Client instruction, 2026-08-13. Nothing sits between the heading and the
  // cards: no sort dropdown, and no search box (the top bar's global search
  // reaches every visit in any state, which a box scoped to one segment's
  // loaded rows never could).
  it('renders no toolbar — no sort dropdown and no search box', () => {
    const { container } = render(
      <VisitorStackList segment="all" visits={[visit()]} loading={false} />,
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(container.querySelector('select')).toBeNull();
    expect(screen.queryByText(/sort/i)).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(container.querySelector('.stack-toolbar, .stack-sort')).toBeNull();
  });

  it('lists visits in the order given — the segment order is the only order', () => {
    const first = visit({ id: 'a', visitor: { ...visit().visitor!, full_name: 'Zara Khan' } });
    const second = visit({ id: 'b', visitor: { ...visit().visitor!, full_name: 'Anil Rao' } });
    render(<VisitorStackList segment="inside" visits={[first, second]} loading={false} />);
    const names = screen.getAllByText(/Zara Khan|Anil Rao/).map((el) => el.textContent);
    expect(names).toEqual(['Zara Khan', 'Anil Rao']);
  });

  it('renders skeletons and no cards while loading', () => {
    const { container } = render(<VisitorStackList segment="inside" visits={[]} loading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryAllByText('Alice Johnson')).toHaveLength(0);
    expect(screen.queryByText(SEGMENT_META.inside.empty)).toBeNull();
  });

  // The list passes NO action down (client instruction, 2026-08-14): the
  // Visitors tab only shows which visitor falls under which category. There is
  // no per-row action prop to wire, and one must not quietly come back.
  it('renders no action button on any card', () => {
    render(
      <VisitorStackList segment="inside" loading={false}
        visits={[visit(), visit({ id: 'b', status: 'checked_out' })]} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  // No duplicate renders, per card (the rule the deleted VisitorStackCard.test
  // pinned on the old stacked row). The grid card's host line carries the host;
  // the department name appears ONLY as that line's fallback when there is no
  // host — never a second time anywhere on the card.
  it('renders the vendor and host exactly once each', () => {
    render(
      <VisitorStackList segment="inside" loading={false}
        visits={[visit({ visitor: { ...visit().visitor!, vendor_name: 'Acme Supplies' } })]} />,
    );
    expect(screen.getAllByText('Acme Supplies')).toHaveLength(1);
    expect(screen.getAllByText('Alice Johnson')).toHaveLength(1);
  });

  it('renders the department only as the host-line fallback, never twice', () => {
    const dept = { id: 'd1', name: 'Finance', code: 'FIN' } as const;
    const first = render(
      <VisitorStackList segment="inside" loading={false}
        visits={[visit({ department: dept } as never)]} />,
    );
    expect(screen.getAllByText(/Host: Finance/)).toHaveLength(1);
    first.unmount();

    render(
      <VisitorStackList segment="inside" loading={false}
        visits={[visit({
          department: dept,
          host: { id: 'h1', full_name: 'Bob Sharma' },
        } as never)]} />,
    );
    expect(screen.getAllByText(/Host: Bob Sharma/)).toHaveLength(1);
    expect(screen.queryAllByText(/Host: Finance/)).toHaveLength(0);
  });

  // Client instruction, 2026-08-16: "always everybody should be able to see who
  // is walk-in and who is pre-approved". Both routes converge on `checked_in`,
  // so from the gate onwards the status badge reads the same for either and the
  // card had stopped saying how the person got in.
  it('says which desk a checked-in visitor came through', () => {
    const first = render(
      <VisitorStackList segment="inside" loading={false}
        visits={[visit({ scheduled_for: '2026-08-13T04:00:00Z' })]} />,
    );
    expect(screen.getByText('Pre-approved')).toBeInTheDocument();
    first.unmount();

    render(<VisitorStackList segment="inside" loading={false} visits={[visit()]} />);
    expect(screen.getByText('Walk-in')).toBeInTheDocument();
  });

  // The badge already spells it out on an unconverged row —
  // STATUS_STYLES.approved reads "Pre-approved" — and the same value twice on
  // one card is what the no-duplicate-renders rule exists to stop.
  it('does not repeat an origin the status badge has already given', () => {
    render(
      <VisitorStackList segment="all" loading={false}
        visits={[visit({ status: 'approved', checked_in_at: null, scheduled_for: '2026-08-13T04:00:00Z' })]} />,
    );
    expect(screen.getAllByText('Pre-approved')).toHaveLength(1);
  });
});
