import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import VisitorCard, { expectedTimeLabel } from '../../../src/pages/Guard/VisitorCard';
import { STATUS_RAIL, railFor } from '../../../src/lib/statusRail';
import type { Visit, VisitStatus } from '../../../src/types/index';

function visit(over: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    ref_number: 'VIS-20260802-0001',
    visitor_id: 'vis1',
    department_id: 'd1',
    host_id: 'h1',
    purpose: 'meeting',
    photo_path: null,
    photo_data: null,
    status: 'checked_in',
    checked_in_at: '2026-08-02T09:00:00Z',
    checked_out_at: null,
    exit_verified: null,
    rejection_reason: null,
    carrying_material: false,
    scheduled_for: null,
    qr_token: 'tok',
    qr_expires_at: null,
    created_at: '2026-08-02T08:00:00Z',
    visitor: { full_name: 'Alice Johnson', company: 'Acme Corp' } as any,
    department: { name: 'Engineering' } as any,
    host: { id: 'h1', full_name: 'Bob Smith' },
    ...over,
  } as Visit;
}

afterEach(cleanup);

describe('VisitorCard', () => {
  it('renders the visitor name, company, department and host', () => {
    render(<VisitorCard visit={visit()} />);
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.getByText(/Engineering/)).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
  });

  it('falls back gracefully when the visitor record is missing', () => {
    render(<VisitorCard visit={visit({ visitor: undefined, host: undefined, department: undefined })} />);
    expect(screen.getByText('Unknown visitor')).toBeInTheDocument();
    // Never render the string "undefined" or "null" at a guard.
    expect(screen.queryByText(/undefined|null/)).toBeNull();
  });

  it('renders the action as a button and fires it', () => {
    const onClick = vi.fn();
    render(<VisitorCard visit={visit()} action={{ label: 'Check Out', onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check Out' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onSelect when the action button is clicked', () => {
    // The action sits inside a clickable card. Without stopPropagation a guard
    // tapping "Check Out" would also open the detail sheet over the top of it.
    const onSelect = vi.fn();
    const onClick = vi.fn();
    render(<VisitorCard visit={visit()} onSelect={onSelect} action={{ label: 'Check Out', onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check Out' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('is keyboard reachable when selectable', () => {
    const onSelect = vi.fn();
    render(<VisitorCard visit={visit()} onSelect={onSelect} />);
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('is not a button when it has no action and no onSelect', () => {
    render(<VisitorCard visit={visit()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the time label when supplied', () => {
    render(<VisitorCard visit={visit()} timeLabel="09:00" />);
    expect(screen.getByText('09:00')).toBeInTheDocument();
  });

  // A guard must never be able to mint an entry pass — see the comment block at
  // the top of Console.tsx and lib/passVisibility.ts.
  it('never renders a QR code or entry pass', () => {
    const { container } = render(<VisitorCard visit={visit()} />);
    expect(container.querySelector('img[alt*="QR" i]')).toBeNull();
    expect(screen.queryByText(/visitor pass|print badge/i)).toBeNull();
  });
});

describe('expectedTimeLabel', () => {
  it('shows the booked time when one is set', () => {
    const label = expectedTimeLabel(visit({ scheduled_for: '2026-08-02T14:30:00Z' }));
    expect(label).not.toBe('Anytime');
    expect(label.length).toBeGreaterThan(0);
  });

  it('shows "Anytime" for an open-ended pre-approval', () => {
    expect(expectedTimeLabel(visit({ scheduled_for: null }))).toBe('Anytime');
  });
});

describe('statusRail', () => {
  const ALL: VisitStatus[] = [
    'pending_approval', 'approved', 'walkin_approved', 'checked_in',
    'checked_out', 'rejected', 'cancelled', 'no_show',
  ];

  it('maps every visit status — no status may fall through', () => {
    ALL.forEach((s) => {
      expect(STATUS_RAIL[s], `missing rail for ${s}`).toBeTruthy();
    });
  });

  it('groups the two approval routes onto the same rail', () => {
    // A guard does not care HOW someone was approved, only that they are due.
    expect(railFor('approved')).toBe(railFor('walkin_approved'));
  });

  it('distinguishes on-site from departed', () => {
    expect(railFor('checked_in')).not.toBe(railFor('checked_out'));
  });

  it('falls back safely for an unknown status', () => {
    expect(railFor('not_a_status' as VisitStatus)).toBe('rail-out');
  });
});
