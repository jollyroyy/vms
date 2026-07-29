import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import OverviewStatCards from '../../../src/pages/HOD/OverviewStatCards';

afterEach(cleanup);

const stats = { inside: 5, approvedToday: 3, pending: 2, rejectedToday: 1 };

describe('OverviewStatCards', () => {
  it('renders all four stat labels', () => {
    render(<OverviewStatCards loading={false} stats={stats} activeFilter={null} onSelect={vi.fn()} />);
    expect(screen.getByText('Inside')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('renders the actual numeric values from stats', () => {
    render(<OverviewStatCards loading={false} stats={stats} activeFilter={null} onSelect={vi.fn()} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows a dash instead of numbers while loading', () => {
    render(<OverviewStatCards loading={true} stats={stats} activeFilter={null} onSelect={vi.fn()} />);
    expect(screen.getAllByText('—').length).toBe(4);
    expect(screen.queryByText('5')).not.toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('renders zero values as "0", not blank', () => {
    render(<OverviewStatCards loading={false} stats={{ inside: 0, approvedToday: 0, pending: 0, rejectedToday: 0 }} activeFilter={null} onSelect={vi.fn()} />);
    expect(screen.getAllByText('0').length).toBe(4);
  });

  it('calls onSelect with correct key when card is clicked', () => {
    const onSelect = vi.fn();
    render(<OverviewStatCards loading={false} stats={stats} activeFilter={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Inside').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('inside');

    fireEvent.click(screen.getByText('Approved').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('approved');

    fireEvent.click(screen.getByText('Pending').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('pending');

    fireEvent.click(screen.getByText('Rejected').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('rejected');
  });

  it('calls onSelect with empty string when active card is clicked again', () => {
    const onSelect = vi.fn();
    render(<OverviewStatCards loading={false} stats={stats} activeFilter="inside" onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Inside').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('');
  });

  it('applies active styling to the selected card', () => {
    render(<OverviewStatCards loading={false} stats={stats} activeFilter="inside" onSelect={vi.fn()} />);

    const insideBtn = screen.getByText('Inside').closest('button')!;
    expect(insideBtn.className).toContain('ring-2');
    expect(insideBtn.className).toContain('ring-brand-500/20');
  });
});
