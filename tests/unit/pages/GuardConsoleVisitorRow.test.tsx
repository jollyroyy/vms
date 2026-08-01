import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import GuardConsoleVisitorRow from '../../../src/pages/Guard/GuardConsoleVisitorRow';
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
    status: 'rejected',
    checked_in_at: null,
    checked_out_at: null,
    exit_verified: null,
    rejection_reason: 'Not expected',
    carrying_material: false,
    scheduled_for: null,
    created_at: '2026-07-30T04:00:00Z',
    visitor: { id: 'vis1', phone: '9999999999', full_name: 'Jane Doe', company: null, id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: '2026-07-30T00:00:00Z' },
    department: { id: 'd1', name: 'Engineering', code: 'ENG', created_at: '2026-01-01T00:00:00Z' },
    ...overrides,
  };
}

describe('GuardConsoleVisitorRow — status badge', () => {
  it('shows a status badge distinguishing rejected from cancelled when showStatus is set', () => {
    render(<GuardConsoleVisitorRow visit={visit({ status: 'rejected' })} showStatus />);
    expect(screen.getByText('Denied')).toBeInTheDocument();
  });

  it('shows the cancelled label for a cancelled visit', () => {
    render(<GuardConsoleVisitorRow visit={visit({ status: 'cancelled' })} showStatus />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('hides the status badge when showStatus is not set', () => {
    render(<GuardConsoleVisitorRow visit={visit({ status: 'rejected' })} />);
    expect(screen.queryByText('Denied')).not.toBeInTheDocument();
  });

  it('still renders the action button alongside the status badge', () => {
    const onClick = vi.fn();
    render(<GuardConsoleVisitorRow visit={visit({ status: 'checked_in' })} showStatus action={{ label: 'Check Out', onClick }} />);
    expect(screen.getByText('Check Out')).toBeInTheDocument();
  });
});
