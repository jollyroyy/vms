// New component (src/pages/Guard/DashboardQuickActions.tsx) — the two-button
// launcher panel on the guard dashboard. Takes no props and renders <Link>s,
// so it needs a MemoryRouter, unlike most guard dashboard pieces.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardQuickActions from '../../../src/pages/Guard/DashboardQuickActions';

afterEach(cleanup);

function renderPanel() {
  render(
    <MemoryRouter>
      <DashboardQuickActions />
    </MemoryRouter>,
  );
}

describe('DashboardQuickActions', () => {
  it('renders the Quick Actions heading', () => {
    renderPanel();
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  it('renders the Walk-in Visitor action, linking to /visitors/walk-in', () => {
    renderPanel();
    expect(screen.getByText('Walk-in Visitor')).toBeInTheDocument();
    expect(screen.getByText('Register new visitor')).toBeInTheDocument();
    const link = screen.getByText('Walk-in Visitor').closest('a');
    expect(link).toHaveAttribute('href', '/visitors/walk-in');
  });

  it('renders the Scan QR action, linking to /guard/scan-pass', () => {
    renderPanel();
    expect(screen.getByText('Scan QR')).toBeInTheDocument();
    expect(screen.getByText('Verify a visitor pass')).toBeInTheDocument();
    const link = screen.getByText('Scan QR').closest('a');
    expect(link).toHaveAttribute('href', '/guard/scan-pass');
  });

  it('renders exactly two actions', () => {
    renderPanel();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  // Regression guard: the reference design this panel was built from had four
  // buttons. "Issue Pass" is forbidden outright — CLAUDE.md's guard-surface
  // rule is that a guard must never be able to mint an entry pass — and
  // "Report Incident" has no backing table, page or route anywhere in this
  // app, so it would ship as a dead button. Neither may ever appear here.
  it('never renders Issue Pass or Report Incident', () => {
    renderPanel();
    expect(screen.queryByText(/issue pass/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/report incident/i)).not.toBeInTheDocument();
  });
});
