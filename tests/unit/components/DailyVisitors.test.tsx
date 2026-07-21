import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import DailyVisitors from '../../../src/components/DailyVisitors';
import type { DailyVisitor } from '../../../src/components/DailyVisitors';

afterEach(cleanup);

const visitors: DailyVisitor[] = [
  {
    id: 'dv1',
    full_name: 'Sunita Devi',
    type: 'maid',
    department: 'Housekeeping',
    phone: '9876543210',
    photo_url: null,
    last_visit_date: '2026-07-20T08:30:00Z',
    is_active: true,
    checked_in_today: true,
  },
  {
    id: 'dv2',
    full_name: 'Rajesh Kumar',
    type: 'worker',
    department: 'Maintenance',
    phone: '9123456780',
    photo_url: null,
    last_visit_date: '2026-07-19T09:00:00Z',
    is_active: true,
    checked_in_today: false,
  },
  {
    id: 'dv3',
    full_name: 'Amit Patel',
    type: 'vendor',
    department: 'Supplies',
    phone: '9988776655',
    photo_url: null,
    last_visit_date: '2026-07-18T14:00:00Z',
    is_active: false,
    checked_in_today: false,
  },
];

describe('DailyVisitors component', () => {
  it('renders the component with visitors', () => {
    render(<DailyVisitors visitors={visitors} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('Daily Visitors')).toBeInTheDocument();
    expect(screen.getByText('Sunita Devi')).toBeInTheDocument();
    expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument();
  });

  it('shows correct stat counts', () => {
    render(<DailyVisitors visitors={visitors} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('3')).toBeInTheDocument(); // Total Active
    expect(screen.getAllByText('1')).toHaveLength(2); // Checked In Today (1) + Pending (1)
  });

  it('filters visitors by search', () => {
    render(<DailyVisitors visitors={visitors} onAdd={vi.fn()} onRemove={vi.fn()} />);
    const input = screen.getByPlaceholderText('Search visitors...');
    fireEvent.change(input, { target: { value: 'Rajesh' } });
    expect(screen.queryByText('Sunita Devi')).not.toBeInTheDocument();
    expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument();
  });

  it('calls onAdd when form is submitted', () => {
    const onAdd = vi.fn();
    render(<DailyVisitors visitors={[]} onAdd={onAdd} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByText('Add New'));

    fireEvent.change(screen.getByPlaceholderText('e.g. Sunita Devi'), { target: { value: 'New Maid' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Housekeeping'), { target: { value: 'Cleaning' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 9876543210'), { target: { value: '9000000000' } });

    fireEvent.click(screen.getByText('Add Visitor'));

    expect(onAdd).toHaveBeenCalledWith({
      full_name: 'New Maid',
      type: 'maid',
      department: 'Cleaning',
      phone: '9000000000',
      photo_url: null,
    });
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<DailyVisitors visitors={visitors} onAdd={vi.fn()} onRemove={onRemove} />);

    const removeBtn = screen.getByTitle('Remove Sunita Devi');
    fireEvent.click(removeBtn);

    expect(onRemove).toHaveBeenCalledWith('dv1');
  });

  it('shows checked-in badge for visitors checked in today', () => {
    render(<DailyVisitors visitors={visitors} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('In')).toBeInTheDocument();
  });

  it('filters by type using the dropdown', () => {
    render(<DailyVisitors visitors={visitors} onAdd={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByText('All Daily Visitors'));
    const select = screen.getByDisplayValue('All Types');
    fireEvent.change(select, { target: { value: 'vendor' } });
    expect(screen.queryByText('Sunita Devi')).not.toBeInTheDocument();
    expect(screen.queryByText('Rajesh Kumar')).not.toBeInTheDocument();
    expect(screen.getByText('Amit Patel')).toBeInTheDocument();
  });

  it('displays initials avatar when no photo_url', () => {
    render(<DailyVisitors visitors={visitors} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('SD')).toBeInTheDocument();
    expect(screen.getByText('RK')).toBeInTheDocument();
  });

  it('shows empty state when no visitors match search', () => {
    render(<DailyVisitors visitors={visitors} onAdd={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Search visitors...'), { target: { value: 'zzz' } });
    expect(screen.getByText('No visitors found')).toBeInTheDocument();
  });

  it('switches to add form and back via Cancel', () => {
    render(<DailyVisitors visitors={visitors} onAdd={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByText('Add New'));
    expect(screen.getByText('Add Daily Visitor')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Add Daily Visitor')).not.toBeInTheDocument();
  });
});
