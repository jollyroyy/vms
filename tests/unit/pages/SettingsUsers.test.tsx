import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import SettingsUsers from '../../../src/pages/Admin/SettingsUsers';
import type { DirectoryUser } from '../../../src/lib/adminUsers';

// Settings → Users. Mocked at `lib/adminUsers`, not at the supabase client
// underneath it: the page's own contract is "call these five functions and
// render what comes back", and every one of them is a SECURITY DEFINER RPC
// whose rules live in migrations 095/096, not here.

const api = vi.hoisted(() => ({
  fetchUserDirectory: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deactivateUser: vi.fn(),
  reactivateUser: vi.fn(),
}));

vi.mock('../../../src/lib/adminUsers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/adminUsers')>();
  return { ...actual, ...api };
});

vi.mock('../../../src/lib/useDepartments', () => ({
  useDepartments: () => ({
    departments: [{ id: 'dept-1', name: 'Facilities', code: 'FAC', created_at: '2026-01-01T00:00:00Z' }],
    error: '',
    reload: vi.fn(),
  }),
}));

// The password-reset section reaches for supabase.rpc on mount of the edit
// modal; it is migration 064's flow and has its own suite.
vi.mock('../../../src/pages/Admin/HodPasswordReset', () => ({
  default: () => <div data-testid="password-reset-stub" />,
}));

const user = (over: Partial<DirectoryUser> = {}): DirectoryUser => ({
  id: 'u-1',
  email: 'asha@example.com',
  full_name: 'Asha Rao',
  role: 'guard',
  department_id: null,
  avatar_url: null,
  created_at: '2026-08-01T06:00:00Z',
  is_active: true,
  deactivated_at: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchUserDirectory.mockResolvedValue([]);
});
afterEach(cleanup);

describe('Settings → Users', () => {
  it('shows a named empty state rather than a bare table', async () => {
    render(<SettingsUsers />);
    expect(await screen.findByText('No accounts yet.')).toBeInTheDocument();
  });

  it('renders a row per account with its role and status', async () => {
    api.fetchUserDirectory.mockResolvedValue([
      user(),
      user({ id: 'u-2', full_name: 'Bela Sen', role: 'hod', department_id: 'dept-1', email: 'bela@example.com' }),
    ]);
    render(<SettingsUsers />);

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Bela Sen')).toBeInTheDocument();
    expect(screen.getByText('Guard')).toBeInTheDocument();
    expect(screen.getByText('HOD')).toBeInTheDocument();
    // The department name, resolved from the id — never the raw uuid.
    expect(screen.getByText('Facilities')).toBeInTheDocument();
  });

  // A guard has no department BY DESIGN (admin_update_user nulls it), so the
  // cell says so. An em dash there would read as "we do not know".
  it('says "None" for a guard’s department, not a dash', async () => {
    api.fetchUserDirectory.mockResolvedValue([user()]);
    render(<SettingsUsers />);
    expect(await screen.findByText('None')).toBeInTheDocument();
  });

  // `staff` is assignable here and is NOT in GatePass's list: in VMS it is what
  // a HOST is, so an admin who cannot create one cannot onboard a host.
  it('offers Guard, HOD and Staff — and never Admin or CEO', async () => {
    render(<SettingsUsers />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add User' }));

    const roles = within(screen.getByRole('dialog')).getByLabelText('Role') as HTMLSelectElement;
    expect([...roles.options].map((o) => o.value)).toEqual(['guard', 'hod', 'staff']);
  });

  it('creates a user with the typed password and reloads the directory', async () => {
    api.createUser.mockResolvedValue(undefined);
    render(<SettingsUsers />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add User' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Full name'), { target: { value: 'Chandra Bose' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'chandra@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Temporary password'), { target: { value: 'hunter22' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create user' }));

    await waitFor(() => expect(api.createUser).toHaveBeenCalledTimes(1));
    expect(api.createUser.mock.calls[0][0]).toMatchObject({
      fullName: 'Chandra Bose', email: 'chandra@example.com', role: 'guard',
    });
    expect(api.createUser.mock.calls[0][1]).toBe('hunter22');
  });

  // The form stays open with everything typed still in it: reporting that we
  // could not save is no reason to throw away what was entered, with the person
  // standing in front of the admin.
  it('keeps the form and its values when the create fails', async () => {
    api.createUser.mockRejectedValue(new Error('A user with email "x" already exists.'));
    render(<SettingsUsers />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add User' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Full name'), { target: { value: 'Chandra Bose' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'chandra@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Temporary password'), { target: { value: 'hunter22' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create user' }));

    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect((within(screen.getByRole('dialog')).getByLabelText('Full name') as HTMLInputElement).value)
      .toBe('Chandra Bose');
  });

  // Deactivation is destructive and confirmed; reactivation restores exactly
  // what was withdrawn and is not, which is why only one of them has a dialog.
  it('confirms before deactivating, and never deactivates straight off the row', async () => {
    api.fetchUserDirectory.mockResolvedValue([user()]);
    api.deactivateUser.mockResolvedValue(undefined);
    render(<SettingsUsers />);

    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    expect(api.deactivateUser).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog', { name: 'Deactivate this account?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(api.deactivateUser).toHaveBeenCalledWith('u-1'));
  });

  it('reactivates in one click, with no dialog', async () => {
    api.fetchUserDirectory.mockResolvedValue([user({ is_active: false, deactivated_at: '2026-08-10T00:00:00Z' })]);
    api.reactivateUser.mockResolvedValue(undefined);
    render(<SettingsUsers />);

    fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }));
    await waitFor(() => expect(api.reactivateUser).toHaveBeenCalledWith('u-1'));
  });

  // Suspension is a STATUS, not a role: a suspended guard is still a guard, so
  // the Guard filter lists them and the Role column still says Guard.
  it('keeps a suspended account in its role filter, and labels the status separately', async () => {
    api.fetchUserDirectory.mockResolvedValue([user({ is_active: false, deactivated_at: '2026-08-10T00:00:00Z' })]);
    render(<SettingsUsers />);

    expect(await screen.findByText('Suspended')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guards' }));
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
  });

  // Every one of the four RPCs refuses an admin target (the 064 rule: the
  // weakest admin account must not be a route into a stronger one), so the row
  // renders no control rather than one that could only fail.
  it('offers no controls on an admin row', async () => {
    api.fetchUserDirectory.mockResolvedValue([user({ role: 'admin', full_name: 'Root' })]);
    render(<SettingsUsers />);

    expect(await screen.findByText('Managed in Supabase')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).toBeNull();
  });

  // Changing the address somebody signs in with is an auth-admin operation;
  // `admin_update_user` does not accept one, and a writable box here would let
  // the screen show an address the login does not accept.
  it('locks the email when editing', async () => {
    api.fetchUserDirectory.mockResolvedValue([user()]);
    render(<SettingsUsers />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(within(screen.getByRole('dialog')).getByLabelText('Email')).toBeDisabled();
  });

  it('surfaces a directory read failure instead of rendering an empty table', async () => {
    api.fetchUserDirectory.mockRejectedValue(new Error('Only an admin can list users.'));
    render(<SettingsUsers />);
    expect(await screen.findByText(/Only an admin can list users/)).toBeInTheDocument();
  });
});
