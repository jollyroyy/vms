// Card-level tests for the Who's Inside visitor card. Split out from
// WhosInside.test.tsx because the states that matter most here — a visit with
// no approval yet, an approval time that differs from the check-in time — are
// awkward to drive through the page's tab/stat filtering, and the timeline is
// the part a guard actually reads off the screen.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import WhosInsideVisitorCard from '../../../src/pages/Shared/WhosInsideVisitorCard';
import { formatDateTime } from '../../../src/lib/formatDate';
import type { ReportVisit } from '../../../src/lib/reportRow';

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
      id: 'vis1', phone: '9876543210', full_name: 'Asha Rao', vendor_name: 'Acme',
      id_type: 'Aadhaar', id_last4: '9646', vehicle_number: null,
      is_blacklisted: false, blacklist_reason: null, created_at: '2026-01-01T00:00:00Z',
    },
    department: { id: 'dept1', name: 'Finance', code: 'FIN', created_at: '2026-01-01T00:00:00Z' },
    host: { id: 'h1', full_name: 'Ravi Kumar' },
    ...overrides,
  } as ReportVisit;
}

describe('M12-GUARD: WhosInsideVisitorCard timeline', () => {
  it('shows the approval time and the check-in time as separate rows', () => {
    render(<WhosInsideVisitorCard visit={makeVisit()} index={0} onClick={vi.fn()} />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Check-in')).toBeInTheDocument();
    expect(screen.getByText(formatDateTime('2026-07-01T09:00:00Z'))).toBeInTheDocument();
    expect(screen.getByText(formatDateTime('2026-07-01T11:30:00Z'))).toBeInTheDocument();
  });

  it('prefers the audit-log approval time over the visit creation time', () => {
    const visit = makeVisit({ approvedAt: '2026-06-30T14:05:00Z' });
    render(<WhosInsideVisitorCard visit={visit} index={0} onClick={vi.fn()} />);
    expect(screen.getByText(formatDateTime('2026-06-30T14:05:00Z'))).toBeInTheDocument();
    expect(screen.queryByText(formatDateTime('2026-07-01T09:00:00Z'))).not.toBeInTheDocument();
  });

  it('says the visit is not yet approved while it is still pending', () => {
    const visit = makeVisit({ status: 'pending_approval', checked_in_at: null });
    render(<WhosInsideVisitorCard visit={visit} index={0} onClick={vi.fn()} />);
    expect(screen.getByText('Not yet approved')).toBeInTheDocument();
    expect(screen.getByText('Not yet checked in')).toBeInTheDocument();
  });

  it('shows the check-out time once the visitor has left', () => {
    const visit = makeVisit({ status: 'checked_out', checked_out_at: '2026-07-01T17:45:00Z' });
    render(<WhosInsideVisitorCard visit={visit} index={0} onClick={vi.fn()} />);
    expect(screen.getByText(formatDateTime('2026-07-01T17:45:00Z'))).toBeInTheDocument();
    expect(screen.queryByText('Not yet checked out')).not.toBeInTheDocument();
  });

  it('says not yet checked out while the visitor is still inside', () => {
    render(<WhosInsideVisitorCard visit={makeVisit()} index={0} onClick={vi.fn()} />);
    expect(screen.getByText('Not yet checked out')).toBeInTheDocument();
  });
});
