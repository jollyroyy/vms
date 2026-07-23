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
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            if (table === 'departments') return Promise.resolve({ data: mockDeptData });
            return Promise.resolve({ data: mockProfileData });
          },
        }),
      }),
      update: (data: any) => mockUpdate(data),
    }),
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
const hodSession = { user: { id: 'user-2', email: 'hod@example.com' } } as any;
const adminSession = { user: { id: 'user-3', email: 'admin@example.com' } } as any;
const staffSession = { user: { id: 'user-4', email: 'staff@example.com' } } as any;

function renderWithRouter(
  ui: React.ReactElement,
  { route = '/dashboard' } = {},
) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

/* ─── Navigation link tests ──────────────────────────────────────────── */

describe('Sidebar: navigation links', () => {
  it('renders brand logo and SecureGate text', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    expect(screen.getByText('SecureGate')).toBeInTheDocument();
  });

  it('renders correct nav links for guard role', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('Gate Passes')).toBeInTheDocument();
    expect(screen.getByText('On-site')).toBeInTheDocument();
    expect(screen.queryByText('Material Passes')).not.toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('renders correct nav links for HOD role', () => {
    renderWithRouter(<Sidebar session={hodSession} role="hod" />);
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('Material Passes')).toBeInTheDocument();
    expect(screen.getByText('Approvals')).toBeInTheDocument();
    expect(screen.getByText('On-site')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.queryByText('Gate Passes')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('renders correct nav links for admin role', () => {
    renderWithRouter(<Sidebar session={adminSession} role="admin" />);
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('On-site')).not.toBeInTheDocument();
    expect(screen.queryByText('Material Passes')).not.toBeInTheDocument();
  });

  it('renders correct nav links for staff role', () => {
    renderWithRouter(<Sidebar session={staffSession} role="staff" />);
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('On-site')).toBeInTheDocument();
    expect(screen.getByText('Material Passes')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('highlights active link based on current route', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />, { route: '/visitors' });
    const visitorsLinks = screen.getAllByText('Visitors');
    const activeLink = visitorsLinks.find((el) => el.closest('a')?.className.includes('sidebar-link-active'));
    expect(activeLink).toBeTruthy();
  });

  it('does not highlight inactive links', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />, { route: '/whos-inside' });
    const visitorsLinks = screen.getAllByText('Visitors');
    const inactiveLink = visitorsLinks.find((el) => !el.closest('a')?.className.includes('sidebar-link-active'));
    expect(inactiveLink).toBeTruthy();
  });
});

/* ─── Profile card: name, role, department ────────────────────────────── */

describe('Sidebar: profile card — name, role label, department', () => {
  it('shows the profile name fetched from supabase', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    await waitFor(() => {
      expect(screen.getByText('Guard User')).toBeInTheDocument();
    });
  });

  it('shows role label for guard', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    await waitFor(() => {
      expect(screen.getByText('Guard')).toBeInTheDocument();
    });
  });

  it('shows role label "HOD" for hod role', async () => {
    mockProfileData = { full_name: 'Dr. Sharma', department_id: 'dept-2', avatar_url: null };
    mockDeptData = { name: 'Information Technology' };
    renderWithRouter(<Sidebar session={hodSession} role="hod" />);
    await waitFor(() => {
      expect(screen.getByText('HOD')).toBeInTheDocument();
    });
  });

  it('shows department name for HOD under role label', async () => {
    mockProfileData = { full_name: 'Dr. Sharma', department_id: 'dept-2', avatar_url: null };
    mockDeptData = { name: 'Information Technology' };
    renderWithRouter(<Sidebar session={hodSession} role="hod" />);
    await waitFor(() => {
      expect(screen.getByText('Dr. Sharma')).toBeInTheDocument();
      expect(screen.getByText('HOD')).toBeInTheDocument();
      expect(screen.getByText('Information Technology')).toBeInTheDocument();
    });
  });

  it('shows department name for guard', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    await waitFor(() => {
      expect(screen.getByText('IT Department')).toBeInTheDocument();
    });
  });

  it('shows "Admin" role label for admin role', async () => {
    mockProfileData = { full_name: 'Admin User', department_id: null, avatar_url: null };
    renderWithRouter(<Sidebar session={adminSession} role="admin" />);
    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
  });

  it('shows "Staff" role label for staff role', async () => {
    mockProfileData = { full_name: 'Staff Member', department_id: 'dept-1', avatar_url: null };
    renderWithRouter(<Sidebar session={staffSession} role="staff" />);
    await waitFor(() => {
      expect(screen.getByText('Staff')).toBeInTheDocument();
    });
  });

  it('does not render department line when no department_id exists', async () => {
    mockProfileData = { full_name: 'Admin User', department_id: null, avatar_url: null };
    mockGetUser.mockResolvedValue({ data: { user: { app_metadata: {} } } });
    renderWithRouter(<Sidebar session={adminSession} role="admin" />);
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    // Should not show any department text
    expect(screen.queryByText('IT Department')).not.toBeInTheDocument();
  });

  it('falls back to email-derived name if full_name is empty', async () => {
    mockProfileData = { full_name: '', department_id: null, avatar_url: null };
    mockGetUser.mockResolvedValue({ data: { user: { app_metadata: {} } } });
    renderWithRouter(<Sidebar session={{ user: { id: 'u-x', email: 'john.doe@corp.com' } } as any} role="guard" />);
    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });
  });

  it('renders initials from profile name', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    await waitFor(() => {
      // "Guard User" -> "GU"
      expect(screen.getByText('GU')).toBeInTheDocument();
    });
  });

  it('renders initials from email if no profile name', async () => {
    mockProfileData = { full_name: '', department_id: null, avatar_url: null };
    mockGetUser.mockResolvedValue({ data: { user: { app_metadata: {} } } });
    renderWithRouter(<Sidebar session={{ user: { id: 'u-y', email: 'ab@corp.com' } } as any} role="guard" />);
    // Before profile loads, initials from email "ab@corp.com" -> "AB"
    expect(screen.getByText('AB')).toBeInTheDocument();
  });
});

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

/* ─── Sign out ────────────────────────────────────────────────────────── */

describe('Sidebar: sign out', () => {
  it('renders sign out button', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    expect(screen.getByTitle('Sign out')).toBeInTheDocument();
  });

  it('calls supabase.auth.signOut on click', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    fireEvent.click(screen.getByTitle('Sign out'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

/* ─── Mobile menu ─────────────────────────────────────────────────────── */

describe('Sidebar: mobile menu', () => {
  it('toggles mobile menu on hamburger click', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    const beforeCount = screen.getAllByText('Visitors').length;
    const toggleBtn = screen.getByLabelText('Open menu');
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(screen.getAllByText('Visitors').length).toBeGreaterThan(beforeCount);
  });
});

/* ─── HOD-specific e2e: full profile card with department ─────────────── */

describe('Sidebar: HOD end-to-end profile card', () => {
  it('shows name, HOD label, and Finance department', async () => {
    mockProfileData = { full_name: 'Priya Patel', department_id: 'dept-fin', avatar_url: null };
    mockDeptData = { name: 'Finance' };
    renderWithRouter(<Sidebar session={hodSession} role="hod" />);
    await waitFor(() => {
      expect(screen.getByText('Priya Patel')).toBeInTheDocument();
      expect(screen.getByText('HOD')).toBeInTheDocument();
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });
    // Initials should be "PP"
    expect(screen.getByText('PP')).toBeInTheDocument();
  });

  it('shows name, HOD label, and HR department with avatar', async () => {
    mockProfileData = {
      full_name: 'Anil Kumar',
      department_id: 'dept-hr',
      avatar_url: 'https://storage.example.com/avatars/user-2/avatar.jpg',
    };
    mockDeptData = { name: 'Human Resources' };
    renderWithRouter(<Sidebar session={hodSession} role="hod" />);
    await waitFor(() => {
      expect(screen.getByText('Anil Kumar')).toBeInTheDocument();
      expect(screen.getByText('HOD')).toBeInTheDocument();
      expect(screen.getByText('Human Resources')).toBeInTheDocument();
      // Avatar image should be rendered
      const img = screen.getByAltText('Anil Kumar');
      expect(img).toBeInTheDocument();
    });
    // Initials should NOT be visible since avatar is shown
    expect(screen.queryByText('AK')).not.toBeInTheDocument();
  });

  it('uses department_id from profile when JWT has none', async () => {
    mockProfileData = { full_name: 'Raj Singh', department_id: 'dept-eng', avatar_url: null };
    mockDeptData = { name: 'Engineering' };
    // No department in JWT
    mockGetUser.mockResolvedValue({ data: { user: { app_metadata: {} } } });
    renderWithRouter(<Sidebar session={hodSession} role="hod" />);
    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });
  });
});
