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
    const { container } = render(
      <VisitorStackList segment="inside" loading={false}
        visits={[visit(), visit({ id: 'v2', ref_number: 'VIS-2' })]} />,
    );
    expect(container.querySelectorAll('.stack-card')).toHaveLength(2);
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
    expect(container.querySelectorAll('.stack-card')).toHaveLength(0);
    expect(screen.queryByText(SEGMENT_META.inside.empty)).toBeNull();
  });

  it('renders the per-row action only where actionFor returns one', () => {
    const onClick = vi.fn();
    render(
      <VisitorStackList segment="inside" loading={false}
        visits={[visit({ id: 'a' }), visit({ id: 'b', status: 'checked_out' })]}
        actionFor={(v) => (v.status === 'checked_in' ? { label: 'Check Out', onClick } : undefined)} />,
    );
    expect(screen.getAllByText('Check Out')).toHaveLength(1);
  });
});
