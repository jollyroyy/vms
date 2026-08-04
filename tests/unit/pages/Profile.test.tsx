import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import ProfilePage from '../../../src/pages/Shared/Profile';

const mockProfileFetch = vi.fn();

let mockDepartments: any[] = [{ id: 'dept-1', name: 'Finance' }];

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => mockProfileFetch() }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === 'departments') {
        return { select: () => ({ order: () => Promise.resolve({ data: mockDepartments, error: null }) }) };
      }
      return { select: () => ({}) };
    },
    channel: () => {
      const ch: any = {};
      ch.on = () => ch;
      ch.subscribe = vi.fn().mockReturnValue(ch);
      return ch;
    },
    removeChannel: vi.fn(),
  },
}));

const baseProfile = {
  id: 'user-1',
  full_name: 'Jane HOD',
  email: 'hod@example.com',
  avatar_url: null,
  role: 'hod',
  department_id: 'dept-1',
  created_at: '2026-01-01T00:00:00Z',
};

const session = { user: { id: 'user-1', email: 'hod@example.com' } } as any;

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockDepartments = [{ id: 'dept-1', name: 'Finance' }];
  mockProfileFetch.mockResolvedValue({ data: baseProfile, error: null });
});

describe('ProfilePage', () => {
  it('renders the "My Profile" heading', async () => {
    render(<ProfilePage session={session} role="hod" />);
    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument();
    });
  });

  it('renders the loaded profile: name, email, role label and department', async () => {
    render(<ProfilePage session={session} role="hod" />);
    await waitFor(() => {
      expect(screen.getByLabelText('Display name')).toHaveValue('Jane HOD');
    });
    expect(screen.getByText('hod@example.com')).toBeInTheDocument();
    expect(screen.getByText('Head of Department')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
  });

  it('shows "Not assigned" when the profile has no department_id', async () => {
    mockProfileFetch.mockResolvedValue({ data: { ...baseProfile, department_id: null }, error: null });
    render(<ProfilePage session={session} role="hod" />);
    await waitFor(() => {
      expect(screen.getByText('Not assigned')).toBeInTheDocument();
    });
  });

  it('shows an error message and does not render the photo card when the profile fetch fails', async () => {
    mockProfileFetch.mockResolvedValue({ data: null, error: { message: 'Could not reach the server.' } });
    render(<ProfilePage session={session} role="hod" />);
    await waitFor(() => {
      expect(screen.getByText('Could not reach the server.')).toBeInTheDocument();
    });
    expect(screen.queryByLabelText('Choose a profile photo')).not.toBeInTheDocument();
  });
});
