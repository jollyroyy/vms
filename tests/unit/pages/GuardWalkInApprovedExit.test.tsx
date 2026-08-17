import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import GuardWalkInApproved from '../../../src/pages/Guard/GuardWalkInApproved';
import type { Visit } from '../../../src/types/index';

// The desk lists NOBODY who is already through the gate, and it carries no exit
// (client instruction, 2026-08-17).
//
// It used to hold an "Already checked in (N)" section with a Check Out button on
// each admitted row — added on 2026-08-16, when migration 080 briefly made the
// approver's click the admission and left this desk holding rows it could not
// act on. 083 put the admission back at the gate, so the only thing this lane
// owes a visitor is the way IN. An admitted visitor is the Entry & Exit tab's
// subject: that page holds their entry time, their exit time and the one exit
// control, and listing them here as well put one visitor on two surfaces with
// nothing saying which was authoritative.
//
// This file is the guard on that: the heading names the one wait, only rows
// still outside are listed, and no exit control exists on this component at any
// state. lib/checkOutFlow.logVisitExit has exactly one caller again.

// No camera stubs: since 2026-08-17 the check-in form on this lane asks only
// for the visitor card number.
afterEach(() => cleanup());

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    status: 'walkin_approved',
    created_at: '2026-08-16T04:00:00Z',
    checked_in_at: null,
    checked_out_at: null,
    photo_data: null,
    visitor: { full_name: 'Rahul Verma' } as any,
    department: { name: 'Engineering' } as any,
    ...overrides,
  } as unknown as Visit;
}

const admitted = () =>
  visit({
    id: 'admitted',
    status: 'checked_in',
    checked_in_at: '2026-08-16T04:30:00Z',
    visitor: { full_name: 'Already Inside' } as any,
  });

const departed = () =>
  visit({
    id: 'departed',
    status: 'checked_out',
    checked_in_at: '2026-08-16T04:30:00Z',
    checked_out_at: '2026-08-16T06:30:00Z',
    visitor: { full_name: 'Gone Home' } as any,
  });

function baseProps(overrides: Record<string, any> = {}) {
  return {
    loading: false,
    approved: [] as Visit[],
    busyId: null as string | null,
    onCheckIn: vi.fn(),
    ...overrides,
  };
}

describe('GuardWalkInApproved — only the visitors still at the gate', () => {
  it('names the one wait it owns', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit()] })} />);
    expect(screen.getByText('Awaiting gate check-in')).toBeInTheDocument();
    expect(screen.queryByText(/Already checked in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Approved walk-ins/i)).not.toBeInTheDocument();
  });

  it('lists a walk-in still outside, with a Check In button and no exit', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit()] })} />);
    expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
    expect(screen.getByText('Check In')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check Out/i })).not.toBeInTheDocument();
  });

  it('does not list a walk-in who is already inside', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [admitted()] })} />);
    expect(screen.queryByText('Already Inside')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check Out/i })).not.toBeInTheDocument();
    // Nothing left to do here, so the box reads as empty rather than showing a
    // row the guard cannot act on.
    expect(screen.getByText('Nobody is waiting to be checked in.')).toBeInTheDocument();
  });

  it('does not list a walk-in who has already left', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [departed()] })} />);
    expect(screen.queryByText('Gone Home')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check Out/i })).not.toBeInTheDocument();
  });

  // The count beside the heading is the number of Check In buttons under it —
  // the guardTiles.ts rule — so admitted and departed rows must not inflate it.
  it('counts only the rows it lists', () => {
    render(<GuardWalkInApproved {...baseProps({ approved: [visit(), admitted(), departed()] })} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getAllByText('Check In')).toHaveLength(1);
  });
});
