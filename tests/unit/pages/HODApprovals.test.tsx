// Approvals.tsx no longer has tabs, no pending list, no auth fetch, no error
// banner — it moved the pending walk-in queue to the Overview page (see
// OverviewPendingApprovals.test.tsx for that surface). This page is now just
// the header plus <PreApproveForm>, so PreApproveForm is mocked out here —
// its own behaviour is already covered by PreApproveForm.test.tsx and
// friends.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HODApprovals from '../../../src/pages/HOD/Approvals';

vi.mock('../../../src/pages/HOD/PreApproveForm', () => ({
  default: ({ onPreApproved }: { onPreApproved: (name: string, ref: string) => void }) => (
    <div data-testid="pre-approve-form">
      <button onClick={() => onPreApproved('Test Visitor', 'VIS-001')}>Fire onPreApproved</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('M12-HOD: HODApprovals', () => {
  it('renders the Pre-Approve heading and subtitle', () => {
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /^Pre-Approve$/i })).toBeInTheDocument();
    expect(screen.getByText('Invite a visitor before they arrive')).toBeInTheDocument();
  });

  it('renders the PreApproveForm', () => {
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    expect(screen.getByTestId('pre-approve-form')).toBeInTheDocument();
  });

  // Regression guards for the restructure: the tabbed page this used to be
  // had a "Pending" tab and a pending-approvals list — both moved to the
  // Overview and must not reappear here.
  it('does not render a Pending tab', () => {
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });

  it('does not render a pending-approvals list', () => {
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    expect(screen.queryByText('All caught up')).not.toBeInTheDocument();
    expect(screen.queryByText('No pending approvals right now')).not.toBeInTheDocument();
  });
});
