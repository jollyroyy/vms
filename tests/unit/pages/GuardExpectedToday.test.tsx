import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardExpectedToday from '../../../src/pages/Guard/GuardExpectedToday';
import type { Visit } from '../../../src/types/index';

afterEach(() => cleanup());

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    ref_number: 'REF1',
    visitor_id: 'vis1',
    department_id: 'd1',
    host_id: 'h1',
    purpose: 'meeting',
    photo_path: null,
    photo_data: null,
    status: 'approved',
    checked_in_at: null,
    checked_out_at: null,
    exit_verified: null,
    rejection_reason: null,
    carrying_material: false,
    scheduled_for: null,
    created_at: '2026-07-30T04:00:00Z',
    visitor: { id: 'vis1', phone: '9999999999', full_name: 'Jane Doe', vendor_name: null, id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: '2026-07-30T00:00:00Z' },
    department: { id: 'd1', name: 'Engineering', code: 'ENG', created_at: '2026-01-01T00:00:00Z' },
    host: { id: 'h1', full_name: 'Alex Host' },
    ...overrides,
  };
}

function renderList(props: Partial<React.ComponentProps<typeof GuardExpectedToday>> = {}) {
  return render(
    <MemoryRouter>
      <GuardExpectedToday loading={false} visits={[]} {...props} />
    </MemoryRouter>,
  );
}

describe('GuardExpectedToday', () => {
  it('renders the heading', () => {
    renderList();
    expect(screen.getByText('Expected Today')).toBeInTheDocument();
  });

  it('shows an empty state when no one is expected', () => {
    renderList({ visits: [] });
    expect(screen.getByText('No one expected today.')).toBeInTheDocument();
  });

  it('shows a skeleton while loading', () => {
    const { container } = renderList({ loading: true });
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('lists an expected visitor with their scheduled arrival time and status', () => {
    renderList({ visits: [visit({ scheduled_for: '2026-07-30T09:30:00Z', status: 'approved' })] });
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    // VisitorCard renders the host as its own labelled column now, not an
    // inline "Host: Name" string.
    expect(screen.getByText('Host')).toBeInTheDocument();
    expect(screen.getByText('Alex Host')).toBeInTheDocument();
    expect(screen.getByText('Pre-approved')).toBeInTheDocument();
  });

  it('shows "Anytime" for a visitor with no scheduled arrival time', () => {
    renderList({ visits: [visit({ scheduled_for: null })] });
    expect(screen.getByText('Anytime')).toBeInTheDocument();
  });

  it('labels a walk-in-approved visitor distinctly', () => {
    renderList({ visits: [visit({ status: 'walkin_approved' })] });
    expect(screen.getByText('Walk-in approved')).toBeInTheDocument();
  });
});
