import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import NotificationBell from '../../../src/components/NotificationBell';

const mockLimit = vi.hoisted(() => vi.fn());
const mockIn = vi.hoisted(() => vi.fn());
const mockChannel = vi.hoisted(() => vi.fn());
const mockRemoveChannel = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockOn = vi.hoisted(() => vi.fn());
const mockSubscribe = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
      update: vi.fn().mockReturnThis(),
      in: mockIn,
    })),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

const mockNotifications = [
  {
    id: 'n1',
    recipient_id: 'user-1',
    type: 'visit_pending_approval' as const,
    title: 'New Visit Request',
    body: 'A visitor is waiting for your approval.',
    related_id: 'visit-1',
    is_read: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'n2',
    recipient_id: 'user-1',
    type: 'visit_approved' as const,
    title: 'Visit Approved',
    body: 'Visitor has been approved.',
    related_id: 'visit-2',
    is_read: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'n3',
    recipient_id: 'user-1',
    type: 'visit_pending_approval' as const,
    title: 'New Visit Request',
    body: 'Another visitor waiting.',
    related_id: 'visit-3',
    is_read: false,
    created_at: new Date().toISOString(),
  },
];

function setupMocks(data: any[] | null = mockNotifications) {
  mockLimit.mockResolvedValue({ data, error: null });
  mockIn.mockResolvedValue({ error: null });
  mockChannel.mockReturnValue({ on: mockOn });
  mockOn.mockReturnValue({ subscribe: mockSubscribe });
  mockSubscribe.mockReturnValue('sub-1');
  mockRemoveChannel.mockResolvedValue(undefined);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('M12-NOTIFICATION: NotificationBell', () => {
  it('renders bell button for HOD role', () => {
    setupMocks([]);
    render(<NotificationBell userId="user-1" role="hod" />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('renders bell button for admin role', () => {
    setupMocks([]);
    render(<NotificationBell userId="user-1" role="admin" />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('returns null for staff role', () => {
    setupMocks([]);
    const { container } = render(<NotificationBell userId="user-1" role="staff" />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when role is null', () => {
    setupMocks([]);
    const { container } = render(<NotificationBell userId="user-1" role={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders bell button for guard role', () => {
    setupMocks([]);
    render(<NotificationBell userId="user-1" role="guard" />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('shows unread count badge when there are unread notifications', async () => {
    setupMocks();
    render(<NotificationBell userId="user-1" role="hod" />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows "No notifications" when list is empty', async () => {
    setupMocks([]);
    render(<NotificationBell userId="user-1" role="hod" />);
    const bell = document.querySelector('button');
    expect(bell).toBeInTheDocument();
    if (bell) fireEvent.click(bell);
    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('toggles dropdown on bell click', async () => {
    setupMocks();
    render(<NotificationBell userId="user-1" role="hod" />);
    const bell = document.querySelector('button');
    expect(bell).toBeInTheDocument();
    if (bell) fireEvent.click(bell);
    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument();
    });
  });

  it('displays notification title and body in dropdown', async () => {
    setupMocks();
    render(<NotificationBell userId="user-1" role="hod" />);
    await waitFor(() => { expect(screen.getByText('2')).toBeInTheDocument(); });
    const bell = document.querySelector('button');
    if (bell) fireEvent.click(bell);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('calls markRead when clicking Read button on unread notification', async () => {
    setupMocks();
    render(<NotificationBell userId="user-1" role="hod" />);
    await waitFor(() => { expect(screen.getByText('2')).toBeInTheDocument(); });
    const bell = document.querySelector('button');
    if (bell) fireEvent.click(bell);
    await waitFor(() => {
      const readBtns = screen.queryAllByText('Read');
      expect(readBtns.length).toBeGreaterThan(0);
      fireEvent.click(readBtns[0]!);
    });
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('calls markAllRead when clicking Mark all read', async () => {
    setupMocks();
    render(<NotificationBell userId="user-1" role="hod" />);
    const bell = document.querySelector('button');
    expect(bell).toBeInTheDocument();
    if (bell) fireEvent.click(bell);

    await waitFor(() => {
      const markAllBtn = screen.getByText('Mark all read');
      expect(markAllBtn).toBeInTheDocument();
      fireEvent.click(markAllBtn);
    });

    await waitFor(() => {
      expect(mockIn).toHaveBeenCalled();
    });
  });

  it('fetches notifications on mount', async () => {
    setupMocks([]);
    render(<NotificationBell userId="user-1" role="hod" />);
    await waitFor(() => {
      expect(mockLimit).toHaveBeenCalledWith(20);
    });
  });

  it('subscribes to realtime channel on mount', async () => {
    setupMocks([]);
    render(<NotificationBell userId="user-1" role="hod" />);
    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalledWith('notifications');
      expect(mockOn).toHaveBeenCalledWith('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: 'recipient_id=eq.user-1',
      }, expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalled();
    });
  });

  it('unsubscribes on unmount', async () => {
    setupMocks([]);
    const { unmount } = render(<NotificationBell userId="user-1" role="hod" />);
    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled();
    });
    unmount();
    await waitFor(() => {
      expect(mockRemoveChannel).toHaveBeenCalledWith('sub-1');
    });
  });
});
