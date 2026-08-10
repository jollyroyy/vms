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
    expect(screen.getByText('Pending Walk-in Approvals')).toBeInTheDocument();
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

    fireEvent.click(screen.getByText('Pending Walk-in Approvals').closest('button')!);
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

  // Premium type-scale pass (2026-08-10): the number is the one thing each
  // card exists for, so it must render at the kpi scale (`.stat-value`,
  // 36px/800/tabular) with its label two steps down at the micro scale
  // (`.stat-label`, 11px/600 uppercase) — never the old ad hoc
  // `text-3xl font-bold` / `text-xs` utility pair.
  it('renders each number at the kpi scale and its label at the micro scale', () => {
    render(<OverviewStatCards loading={false} stats={stats} activeFilter={null} onSelect={vi.fn()} />);

    const value = screen.getByText('5');
    expect(value.className).toContain('stat-value');

    const label = screen.getByText('Inside');
    expect(label.className).toContain('stat-label');
  });
});
