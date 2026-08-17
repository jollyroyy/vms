import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminSettings from '../../../src/pages/Admin/AdminSettings';
import { defaultSettings } from '../../../src/lib/appSettings';

// AdminSettings needs a Router (it reads/writes `?section=` via useSearchParams).
// `loadSettings`/`saveSettings` are mocked directly rather than the supabase
// client underneath them — the page's own contract is "call these two
// functions", and mocking at that seam keeps the suite about draft/dirty
// behaviour rather than about a PostgREST chain.
const mockLoad = vi.hoisted(() => ({ current: vi.fn(async () => defaultSettings()) }));
const mockSave = vi.hoisted(() => ({ current: vi.fn(async () => ({ error: null })) }));

vi.mock('../../../src/lib/appSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/appSettings')>();
  return {
    ...actual,
    loadSettings: (...args: any[]) => mockLoad.current(...args),
    saveSettings: (...args: any[]) => mockSave.current(...args),
  };
});

vi.mock('../../../src/supabaseClient', () => ({
  supabase: { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'admin-1' } } })) } },
}));

// DepartmentsManager pulls in useDepartments/useHods and a large CRUD tree —
// irrelevant to what this suite checks, which is only that Roles & Users
// renders it rather than setting fields.
vi.mock('../../../src/pages/Admin/DepartmentsManager', () => ({
  default: () => <div data-testid="departments-manager-stub">Departments Manager</div>,
}));

// The load is asynchronous (`useEffect` -> `loadSettings().then(...)`), so
// every test renders, then waits for the loaded panel to replace "Loading
// settings…" before interacting — asserting during the loading window would
// make every field-level query fail regardless of what is being tested.
async function renderLoaded() {
  render(<MemoryRouter><AdminSettings /></MemoryRouter>);
  await screen.findByText('Facility Details');
}

function goTo(sectionLabel: string) {
  fireEvent.click(screen.getByRole('button', { name: sectionLabel }));
}

describe('AdminSettings', () => {
  afterEach(() => {
    cleanup();
    mockLoad.current = vi.fn(async () => defaultSettings());
    mockSave.current = vi.fn(async () => ({ error: null }));
  });

  it('renders all six section names in the rail', async () => {
    await renderLoaded();
    const rail = screen.getByRole('navigation', { name: 'Settings sections' });
    for (const label of ['General', 'Check-In Rules', 'Badges', 'Notifications', 'Integrations', 'Roles & Users']) {
      expect(within(rail).getByText(label)).toBeInTheDocument();
    }
  });

  it('swaps the panel when a different section is clicked', async () => {
    await renderLoaded();
    expect(screen.getByText('Facility Details')).toBeInTheDocument();
    goTo('Check-In Rules');
    expect(screen.queryByText('Facility Details')).toBeNull();
    expect(screen.getByText('Identity')).toBeInTheDocument();
  });

  it('reflects the loaded stored value on a toggle, and flipping it enables Save', async () => {
    // Stored value disagrees with the default (true), so a passing test here
    // proves the control reads `draft`, not `SETTING_DEFAULTS`.
    mockLoad.current = vi.fn(async () => ({ ...defaultSettings(), 'checkin.require_photo': false }));
    await renderLoaded();
    goTo('Check-In Rules');

    const toggle = screen.getByRole('switch', { name: 'Require photo capture at check-in' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveBtn).toBeDisabled();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Save 1 change' })).toBeEnabled();
  });

  // THE MOST VALUABLE TEST IN THE FILE, per the source's own comment: `draft`
  // and `dirty` exist precisely so navigating between sections cannot quietly
  // discard what was typed.
  it('keeps an edit made in one section after switching away and back', async () => {
    await renderLoaded();
    const input = screen.getByLabelText('Facility Name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Star Mall' } });
    expect(screen.getByRole('button', { name: 'Save 1 change' })).toBeEnabled();

    goTo('Badges');
    expect(screen.queryByLabelText('Facility Name')).toBeNull();

    goTo('General');
    expect((screen.getByLabelText('Facility Name') as HTMLInputElement).value).toBe('Star Mall');
    // The dirty count survived the round trip too — the button still reports it.
    expect(screen.getByRole('button', { name: 'Save 1 change' })).toBeInTheDocument();
  });

  it('shows "Recorded — not yet enforced" on an unenforced field and not on an enforced one', async () => {
    await renderLoaded();
    // General: Facility Name (enforced) and "Email invites before visit" (not
    // enforced) sit in the same PANEL, so this also proves the note is scoped
    // per-field rather than shared across the panel. Time Zone used to be the
    // unenforced half of this pair and was removed 2026-08-17 — it was a
    // one-option select governing nothing.
    const facilityRow = screen.getByLabelText('Facility Name').closest('div')!.parentElement!;
    expect(within(facilityRow).queryByText(/Recorded — not yet enforced/)).toBeNull();

    const inviteRow = screen.getByLabelText('Email invites before visit').closest('div')!.parentElement!;
    expect(within(inviteRow).getByText(/Recorded — not yet enforced/)).toBeInTheDocument();

    // And the removed field is gone from the screen entirely, not merely
    // hidden behind a disabled state.
    expect(screen.queryByLabelText('Time Zone')).toBeNull();
  });

  it('renders the departments manager on Roles & Users, not setting fields', async () => {
    await renderLoaded();
    goTo('Roles & Users');
    expect(screen.getByTestId('departments-manager-stub')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByLabelText('Facility Name')).toBeNull();
  });
});
