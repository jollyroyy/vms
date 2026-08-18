// The HOD / employee dashboard's chart band is TWO charts.
//
// Busiest Hosts was removed on 2026-08-18 (client instruction). It ranked the
// people of one department against each other, and since every non-guard,
// non-admin account now gets this board the reader is often one of the handful
// of names in that ranking. The org-wide version of the question is still the
// admin Dashboard's, which is why `topHosts` stays in `lib/adminDashboard.ts`.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import HodDashboardCharts from '../../../src/pages/HOD/HodDashboardCharts';
import type { Visit } from '../../../src/types/index';

afterEach(cleanup);

const now = new Date('2026-08-18T06:00:00Z'); // 11:30 IST

const visit = (over: Partial<Visit> = {}): Visit => ({
  id: 'v1',
  status: 'checked_in',
  purpose: 'Meeting',
  checked_in_at: '2026-08-18T05:00:00Z',
  created_at: '2026-08-18T04:30:00Z',
  host_id: 'h1',
  host: { id: 'h1', full_name: 'Asha Rao' },
  visitor: { id: 'x1', full_name: 'Ravi Kumar' },
  ...over,
} as unknown as Visit);

describe('HodDashboardCharts', () => {
  it('renders Visitor Flow and Visit Purpose', () => {
    render(<HodDashboardCharts visits={[visit()]} now={now} />);
    expect(screen.getByText('Visitor Flow')).toBeTruthy();
    expect(screen.getByText('Visit Purpose')).toBeTruthy();
  });

  it('does NOT render a host ranking', () => {
    render(<HodDashboardCharts visits={[visit()]} now={now} />);
    expect(screen.queryByText(/busiest hosts/i)).toBeNull();
    expect(screen.queryByText(/^Share$/)).toBeNull();
    expect(screen.queryByText('Asha Rao')).toBeNull();
  });

  it('renders both charts on an empty day', () => {
    render(<HodDashboardCharts visits={[]} now={now} />);
    expect(screen.getByText('Visitor Flow')).toBeTruthy();
    expect(screen.getByText('Visit Purpose')).toBeTruthy();
    expect(screen.queryByText(/busiest hosts/i)).toBeNull();
  });
});
