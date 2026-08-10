// Client feedback, 2026-08-10 (see PREMIUM_DESIGN_SPEC.md / DRILL_CARD_SPEC.md):
// "I see the vendor name in the body and also on the top... remove all the
// things from the top which are already mentioned". The defect was every fact
// rendered twice — once as an identity line, once again in a field grid. This
// file pins the fix across every visitor-card component the redesign touched:
// each fact appears in the DOM exactly once per card, and the header holds
// only identity + state, never a body fact.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import WhosInsideVisitorCard from '../../../src/pages/Shared/WhosInsideVisitorCard';
import SearchResultCard from '../../../src/pages/Guard/SearchResultCard';
import CheckInMatchCard from '../../../src/pages/Guard/CheckInMatchCard';
import type { ReportVisit } from '../../../src/lib/reportRow';
import type { Visit } from '../../../src/types/index';
import type { MatchItem } from '../../../src/pages/Guard/CheckInPanel';

afterEach(cleanup);

function makeVisit(overrides: Partial<ReportVisit> = {}): ReportVisit {
  return {
    id: 'v1',
    ref_number: 'VIS-001',
    visitor_id: 'vis1',
    department_id: 'dept1',
    host_id: 'h1',
    purpose: 'meeting',
    photo_path: null,
    photo_data: null,
    status: 'checked_in',
    checked_in_at: '2026-07-01T11:30:00Z',
    checked_out_at: null,
    exit_verified: null,
    rejection_reason: null,
    carrying_material: false,
    scheduled_for: null,
    qr_token: 'tok-1',
    qr_expires_at: null,
    created_at: '2026-07-01T09:00:00Z',
    visitor: {
      id: 'vis1', phone: '9876543210', full_name: 'Asha Rao', vendor_name: 'Acme Supplies',
      id_type: 'Aadhaar', id_last4: '9646', vehicle_number: null,
      is_blacklisted: false, blacklist_reason: null, created_at: '2026-01-01T00:00:00Z',
    },
    department: { id: 'dept1', name: 'Finance', code: 'FIN', created_at: '2026-01-01T00:00:00Z' },
    host: { id: 'h1', full_name: 'Ravi Kumar' },
    ...overrides,
  } as ReportVisit;
}

describe('WhosInsideVisitorCard — no fact appears twice', () => {
  it('renders the visitor name exactly once', () => {
    render(<WhosInsideVisitorCard visit={makeVisit()} index={0} onClick={vi.fn()} />);
    expect(screen.getAllByText('Asha Rao')).toHaveLength(1);
  });

  it('renders the vendor name exactly once', () => {
    render(<WhosInsideVisitorCard visit={makeVisit()} index={0} onClick={vi.fn()} />);
    expect(screen.getAllByText('Acme Supplies')).toHaveLength(1);
  });

  it('renders the host (Person to Meet) name exactly once', () => {
    render(<WhosInsideVisitorCard visit={makeVisit()} index={0} onClick={vi.fn()} />);
    expect(screen.getAllByText('Ravi Kumar')).toHaveLength(1);
  });

  it('renders the department name exactly once', () => {
    render(<WhosInsideVisitorCard visit={makeVisit()} index={0} onClick={vi.fn()} />);
    expect(screen.getAllByText('Finance')).toHaveLength(1);
  });

  it('keeps the vendor, host and department OUT of the header identity row', () => {
    const { container } = render(<WhosInsideVisitorCard visit={makeVisit()} index={0} onClick={vi.fn()} />);
    const header = container.querySelector('[data-card-header]');
    expect(header).not.toBeNull();
    expect(header!.textContent).not.toContain('Acme Supplies');
    expect(header!.textContent).not.toContain('Ravi Kumar');
    expect(header!.textContent).not.toContain('Finance');
    // Identity + state IS allowed in the header.
    expect(header!.textContent).toContain('Asha Rao');
  });
});

describe('SearchResultCard — no fact appears twice', () => {
  it('renders the visitor name and vendor name exactly once each', () => {
    const visit = {
      id: 'v1', ref_number: 'VIS-002', status: 'checked_in', purpose: 'meeting',
      created_at: '2026-08-02T09:00:00Z', scheduled_for: null,
      visitor: { full_name: 'Priya Nair', phone: '9876543210', vendor_name: 'Beta Traders' },
      department: { name: 'Engineering' },
      host: { full_name: 'Bob Smith' },
    } as unknown as Visit;
    render(<SearchResultCard visit={visit} onClick={vi.fn()} />);
    expect(screen.getAllByText('Priya Nair')).toHaveLength(1);
    expect(screen.getAllByText('Beta Traders')).toHaveLength(1);
  });
});

describe('CheckInMatchCard — no fact appears twice', () => {
  function matchItem(overrides: Partial<MatchItem> = {}): MatchItem {
    return {
      id: 'pre:1', source: 'pre_approved', visitorName: 'Karan Mehta', visitorPhone: '9999999999',
      departmentName: 'Engineering', purpose: 'meeting', hostName: 'Dev Host',
      vendorName: 'Gamma Vendors', approvalType: 'pre_approved', approvedAt: null,
      scheduledFor: null, visitId: '1',
      ...overrides,
    };
  }

  it('renders the visitor name exactly once', () => {
    render(<CheckInMatchCard match={matchItem()} disabled={false} isCheckedIn={false} expired={false} onSelect={vi.fn()} />);
    expect(screen.getAllByText('Karan Mehta')).toHaveLength(1);
  });

  it('renders the vendor name exactly once', () => {
    render(<CheckInMatchCard match={matchItem()} disabled={false} isCheckedIn={false} expired={false} onSelect={vi.fn()} />);
    expect(screen.getAllByText('Gamma Vendors')).toHaveLength(1);
  });
});
