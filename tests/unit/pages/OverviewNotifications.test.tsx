import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Notification } from '../../../src/types/index';
import OverviewNotifications from '../../../src/pages/HOD/OverviewNotifications';

afterEach(cleanup);

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const makeNotif = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'n1',
  recipient_id: 'u1',
  type: 'visitor_checked_in',
  title: 'Visitor arrived',
  body: 'Jane Doe has checked in at reception.',
  related_id: 'v1',
  is_read: false,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('OverviewNotifications', () => {
  it('renders the "Status & Notifications" heading', () => {
    renderWithRouter(<OverviewNotifications loading={false} notifs={[]} onMarkRead={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Status & Notifications/i })).toBeInTheDocument();
  });

  it('shows the empty state when there are no notifications', () => {
    renderWithRouter(<OverviewNotifications loading={false} notifs={[]} onMarkRead={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('No notifications')).toBeInTheDocument();
    expect(screen.getByText('Visitor arrivals will appear here in real-time.')).toBeInTheDocument();
  });

  it('does not show the empty state while loading', () => {
    renderWithRouter(<OverviewNotifications loading={true} notifs={[]} onMarkRead={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByText('No notifications')).not.toBeInTheDocument();
  });

  it('renders a notification title and body for a real row', () => {
    const notifs = [makeNotif()];
    renderWithRouter(<OverviewNotifications loading={false} notifs={notifs} onMarkRead={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Visitor arrived')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe has checked in at reception.')).toBeInTheDocument();
    // Empty state must not also render once a real row is present.
    expect(screen.queryByText('No notifications')).not.toBeInTheDocument();
  });

  it('renders multiple notifications as separate rows', () => {
    const notifs = [
      makeNotif({ id: 'n1', title: 'First notification' }),
      makeNotif({ id: 'n2', title: 'Second notification', type: 'visit_pending_approval' }),
    ];
    renderWithRouter(<OverviewNotifications loading={false} notifs={notifs} onMarkRead={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('First notification')).toBeInTheDocument();
    expect(screen.getByText('Second notification')).toBeInTheDocument();
  });

  it('calls onMarkRead with the correct id when the mark-as-read button is clicked', () => {
    const onMarkRead = vi.fn();
    const notifs = [makeNotif({ id: 'notif-42' })];
    renderWithRouter(<OverviewNotifications loading={false} notifs={notifs} onMarkRead={onMarkRead} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Mark as read'));
    expect(onMarkRead).toHaveBeenCalledTimes(1);
    expect(onMarkRead).toHaveBeenCalledWith('notif-42');
  });

  it('calls onDismiss with the correct id when the dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    const notifs = [makeNotif({ id: 'notif-99' })];
    renderWithRouter(<OverviewNotifications loading={false} notifs={notifs} onMarkRead={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTitle('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith('notif-99');
  });

  it('calls onMarkRead/onDismiss with the id of the clicked row, not another row', () => {
    const onMarkRead = vi.fn();
    const notifs = [
      makeNotif({ id: 'first', title: 'First' }),
      makeNotif({ id: 'second', title: 'Second' }),
    ];
    renderWithRouter(<OverviewNotifications loading={false} notifs={notifs} onMarkRead={onMarkRead} onDismiss={vi.fn()} />);
    const buttons = screen.getAllByTitle('Mark as read');
    fireEvent.click(buttons[1]);
    expect(onMarkRead).toHaveBeenCalledWith('second');
    expect(onMarkRead).not.toHaveBeenCalledWith('first');
  });

  it('does not crash and still renders when the body is an unusually long string', () => {
    const longBody = 'A'.repeat(500);
    const notifs = [makeNotif({ id: 'long', body: longBody })];
    expect(() => renderWithRouter(<OverviewNotifications loading={false} notifs={notifs} onMarkRead={vi.fn()} onDismiss={vi.fn()} />)).not.toThrow();
    expect(screen.getByText(longBody)).toBeInTheDocument();
  });
});
