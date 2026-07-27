import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OverviewStatCards from '../../../src/pages/HOD/OverviewStatCards';

afterEach(cleanup);

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const stats = { inside: 5, approvedToday: 3, pending: 2, rejectedToday: 1 };

describe('OverviewStatCards', () => {
  it('renders all four stat labels', () => {
    renderWithRouter(<OverviewStatCards loading={false} stats={stats} />);
    expect(screen.getByText('Inside')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('renders the actual numeric values from stats', () => {
    renderWithRouter(<OverviewStatCards loading={false} stats={stats} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows a dash instead of numbers while loading', () => {
    renderWithRouter(<OverviewStatCards loading={true} stats={stats} />);
    // 4 cards, each showing the loading placeholder instead of its number.
    expect(screen.getAllByText('—').length).toBe(4);
    expect(screen.queryByText('5')).not.toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('renders zero values as "0", not blank', () => {
    renderWithRouter(<OverviewStatCards loading={false} stats={{ inside: 0, approvedToday: 0, pending: 0, rejectedToday: 0 }} />);
    expect(screen.getAllByText('0').length).toBe(4);
  });

  it('links Inside, Approved and Pending cards to /approvals but leaves Rejected as a plain card', () => {
    renderWithRouter(<OverviewStatCards loading={false} stats={stats} />);
    const insideLink = screen.getByText('Inside').closest('a');
    const approvedLink = screen.getByText('Approved').closest('a');
    const pendingLink = screen.getByText('Pending').closest('a');
    const rejectedLink = screen.getByText('Rejected').closest('a');
    expect(insideLink).not.toBeNull();
    expect(insideLink).toHaveAttribute('href', '/approvals');
    expect(approvedLink).not.toBeNull();
    expect(pendingLink).not.toBeNull();
    // Rejected has no `link` value in the component's card config — must not be an <a>.
    expect(rejectedLink).toBeNull();
  });
});
