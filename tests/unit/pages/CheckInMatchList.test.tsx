import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CheckInMatchList from '../../../src/pages/Guard/CheckInMatchList';
import type { MatchItem } from '../../../src/pages/Guard/CheckInPanel';

afterEach(() => cleanup());

function baseProps(overrides: Partial<React.ComponentProps<typeof CheckInMatchList>> = {}) {
  return {
    error: '',
    search: 'jane',
    onSearchChange: vi.fn(),
    deptFilter: '',
    onDeptFilterChange: vi.fn(),
    departments: [],
    loading: false,
    allMatches: [],
    preApproved: [],
    checkedInIds: new Set<string>(),
    isExpired: () => false,
    onSelectMatch: vi.fn(),
    showWalkIn: false,
    onShowWalkIn: vi.fn(),
    onWalkInSubmitted: vi.fn(),
    onWalkInCancel: vi.fn(),
    ...overrides,
  };
}

function match(overrides: Partial<MatchItem> = {}): MatchItem {
  return {
    id: 'pre:1',
    source: 'pre_approved',
    visitorName: 'Jane Doe',
    visitorPhone: '9999999999',
    departmentName: 'Engineering',
    purpose: 'meeting',
    hostName: '',
    company: '',
    visitId: '1',
    ...overrides,
  };
}

describe('CheckInMatchList — host name and company', () => {
  it('shows the host name and company on a pre-approved visitor card', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ hostName: 'Alex Host', company: 'Acme Corp' })],
    })} />);
    expect(screen.getByText(/Host: Alex Host/)).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
  });

  it('shows only the host name when no company is present', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ hostName: 'Alex Host', company: '' })],
    })} />);
    expect(screen.getByText('Host: Alex Host')).toBeInTheDocument();
  });

  it('renders no host/company line when both are absent', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ hostName: '', company: '' })],
    })} />);
    expect(screen.queryByText(/Host:/)).not.toBeInTheDocument();
  });
});
