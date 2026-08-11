import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import OverviewUpcoming from '../../../src/pages/HOD/OverviewUpcoming';
import type { Visit } from '../../../src/types/index';

const visit = {
  id: 'v1',
  ref_number: 'VIS-20260804-0023',
  status: 'approved',
  purpose: 'delivery',
  scheduled_for: '2026-08-26T20:05:00Z',
  created_at: '2026-08-04T09:30:00Z',
  visitor: { full_name: 'Soham Patra', phone: '9999999999', vendor_name: 'Acme Logistics' },
  department: { name: 'Information Technology' },
  host: { full_name: 'Priya Sharma' },
} as unknown as Visit;

afterEach(() => cleanup());

describe('OverviewUpcoming — the card', () => {
  it('leads with the visitor, not the purpose', () => {
    render(<OverviewUpcoming loading={false} upcoming={[visit]} />);
    expect(screen.getByText('Soham Patra')).toBeInTheDocument();
  });

  it('calls the card a visitor pass', () => {
    render(<OverviewUpcoming loading={false} upcoming={[visit]} />);
    expect(screen.getByText('Visitor Pass')).toBeInTheDocument();
  });

  // The card printed the visitor's name once against the purpose line and again
  // as a chip underneath, and the vendor name twice the same way. CLAUDE.md:
  // "No duplicate renders — never render the same data value twice in a single
  // card/widget."
  it('names the visitor exactly once', () => {
    render(<OverviewUpcoming loading={false} upcoming={[visit]} />);
    expect(screen.getAllByText('Soham Patra')).toHaveLength(1);
  });

  it('names the vendor exactly once', () => {
    render(<OverviewUpcoming loading={false} upcoming={[visit]} />);
    expect(screen.getAllByText('Acme Logistics')).toHaveLength(1);
  });

  // It used to be glued to the purpose with an em dash — "Delivery — Acme
  // Logistics" — which read as one compound label rather than two facts.
  it('does not splice the purpose and the vendor into one string', () => {
    render(<OverviewUpcoming loading={false} upcoming={[visit]} />);
    expect(screen.queryByText(/Delivery\s*—\s*Acme Logistics/)).not.toBeInTheDocument();
  });

  // The field that tells an HOD whether the visit is theirs to care about.
  it('gives Person to Meet its own labelled block with the department', () => {
    render(<OverviewUpcoming loading={false} upcoming={[visit]} />);
    expect(screen.getByText('Person to Meet')).toBeInTheDocument();
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    expect(screen.getByText('Information Technology')).toBeInTheDocument();
  });

  it('still shows the purpose, as its own chip', () => {
    render(<OverviewUpcoming loading={false} upcoming={[visit]} />);
    expect(screen.getByText('Delivery')).toBeInTheDocument();
  });

  it('renders a visitor with no vendor without an empty line', () => {
    const noVendor = { ...visit, visitor: { ...visit.visitor, vendor_name: null } } as unknown as Visit;
    render(<OverviewUpcoming loading={false} upcoming={[noVendor]} />);
    expect(screen.getByText('Soham Patra')).toBeInTheDocument();
    expect(screen.queryByText('Acme Logistics')).not.toBeInTheDocument();
  });

  it('shows the empty state when there is nothing upcoming', () => {
    render(<OverviewUpcoming loading={false} upcoming={[]} />);
    expect(screen.getByText('No upcoming visits')).toBeInTheDocument();
  });
});
