import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../../src/components/layout/Sidebar';

/* ─── Supabase mock ──────────────────────────────────────────────────── */

const mockSignOut = vi.fn().mockResolvedValue({ error: null });
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { app_metadata: { department_id: 'dept-1' } } },
});
const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockGetPublicUrl = vi.fn().mockReturnValue({
  data: { publicUrl: 'https://storage.example.com/avatars/user-1/avatar.jpg' },
});
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});

// Default profile data — can be overridden per-test via mockProfileData
let mockProfileData: any = { full_name: 'Guard User', department_id: 'dept-1', avatar_url: null };
let mockDeptData: any = { name: 'IT Department' };

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: {
      signOut: (...args: any[]) => mockSignOut(...args),
      getUser: (...args: any[]) => mockGetUser(...args),
    },
    from: (table: string) => {
      // For visits / gate_passes queries from SidebarAnalytics: select().eq().gte()
      if (table === 'visits' || table === 'gate_passes') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => Promise.resolve({ data: [], error: null }),
              maybeSingle: () => Promise.resolve({ data: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => {
              if (table === 'departments') return Promise.resolve({ data: mockDeptData });
              return Promise.resolve({ data: mockProfileData });
            },
          }),
        }),
        update: (data: any) => mockUpdate(data),
      };
    },
    channel: () => {
      const ch: any = {};
      ch.on = () => ch;
      ch.subscribe = vi.fn().mockReturnValue(ch);
      return ch;
    },
    removeChannel: vi.fn(),
    storage: {
      from: () => ({
        upload: (...args: any[]) => mockUpload(...args),
        getPublicUrl: (...args: any[]) => mockGetPublicUrl(...args),
      }),
    },
  },
}));

vi.mock('../../../src/lib/theme', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockProfileData = { full_name: 'Guard User', department_id: 'dept-1', avatar_url: null };
  mockDeptData = { name: 'IT Department' };
  mockGetUser.mockResolvedValue({
    data: { user: { app_metadata: { department_id: 'dept-1' } } },
  });
});

/* ─── Sessions ───────────────────────────────────────────────────────── */

const guardSession = { user: { id: 'user-1', email: 'guard@example.com' } } as any;

function renderWithRouter(
  ui: React.ReactElement,
  { route = '/dashboard' } = {},
) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

/* ─── Profile card: avatar photo ──────────────────────────────────────── */

describe('Sidebar: profile card — avatar photo', () => {
  it('shows initials when no avatar_url exists', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    await waitFor(() => {
      expect(screen.getByText('GU')).toBeInTheDocument();
    });
    // No <img> should be rendered for avatar
    const profileCard = screen.getByTitle('Change profile photo');
    expect(profileCard.querySelector('img')).toBeNull();
  });

  it('shows avatar image when avatar_url exists', async () => {
    mockProfileData = {
      full_name: 'Guard User',
      department_id: 'dept-1',
      avatar_url: 'https://storage.example.com/avatars/user-1/avatar.jpg',
    };
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    await waitFor(() => {
      const img = screen.getByAltText('Guard User');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://storage.example.com/avatars/user-1/avatar.jpg');
    });
  });

  it('renders a hidden file input for photo upload', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe('image/*');
    expect(fileInput.className).toContain('hidden');
  });

  it('has a clickable "Change profile photo" button', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    await waitFor(() => {
      const btn = screen.getByTitle('Change profile photo');
      expect(btn).toBeInTheDocument();
      expect(btn.tagName).toBe('BUTTON');
    });
  });

  it('triggers file input click when avatar is clicked', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    await waitFor(() => {
      const btn = screen.getByTitle('Change profile photo');
      fireEvent.click(btn);
    });

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('uploads a photo and updates the avatar', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['photo-data'], 'photo.png', { type: 'image/png' });

    await waitFor(() => {
      expect(screen.getByText('Guard User')).toBeInTheDocument();
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(
        'user-1/avatar.png',
        file,
        { upsert: true },
      );
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ avatar_url: expect.stringContaining('https://storage.example.com/avatars/user-1/avatar.jpg') }),
      );
    });
  });

  it('rejects files larger than 2 MB silently', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    // Create a fake file > 2MB
    const bigFile = new File(['x'.repeat(3 * 1024 * 1024)], 'huge.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    // Upload should NOT be called
    await waitFor(() => {
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });

  it('rejects non-image files silently', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const textFile = new File(['hello'], 'readme.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [textFile] } });

    await waitFor(() => {
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });
});
