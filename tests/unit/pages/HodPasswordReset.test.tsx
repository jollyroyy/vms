// TDD: admin-driven password reset, presented inside the HOD edit flow.
// See supabase/migrations/064_admin_password_reset.sql for the RPC contract:
// admin_reset_user_password(p_user_id, p_password) -> { id, email, must_change_password }.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import HodPasswordReset from '../../../src/pages/Admin/HodPasswordReset';

const mockRpc = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    rpc: (...a: any[]) => mockRpc(...a),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: { id: 'p1', email: 'asha@corp.com', must_change_password: true }, error: null });
});
afterEach(cleanup);

function renderReset() {
  return render(<HodPasswordReset userId="p1" userName="Asha Rao" />);
}

function openForm() {
  fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
}

describe('HodPasswordReset', () => {
  it('does not show the reset form until the admin opts in (two-step)', () => {
    renderReset();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('expands into the real form when the reset affordance is clicked', () => {
    renderReset();
    openForm();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
  });

  it('refuses a password under 6 characters without calling the RPC', async () => {
    renderReset();
    openForm();
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls admin_reset_user_password with exactly p_user_id and p_password', async () => {
    renderReset();
    openForm();
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'freshpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('admin_reset_user_password', {
        p_user_id: 'p1',
        p_password: 'freshpass123',
      });
    });
  });

  it('shows the new password back to the admin on success, with a "will not be shown again" note', async () => {
    renderReset();
    openForm();
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'freshpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));

    expect(await screen.findByText('freshpass123')).toBeInTheDocument();
    expect(screen.getByText(/will not be shown again/i)).toBeInTheDocument();
    expect(screen.getByText(/next sign.?in/i)).toBeInTheDocument();
  });

  it('surfaces an RPC error and keeps the form open', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Admin passwords cannot be reset from the panel. Use the Supabase dashboard.' },
    });
    renderReset();
    openForm();
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'freshpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));

    expect(await screen.findByText(/use the supabase dashboard/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
  });

  it('the Generate button fills the field with a strong random password', () => {
    renderReset();
    openForm();
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    const field = screen.getByLabelText(/new password/i) as HTMLInputElement;
    expect(field.value.length).toBeGreaterThanOrEqual(12);
  });

  it('toggles the password field between hidden and visible text', () => {
    renderReset();
    openForm();
    const field = screen.getByLabelText(/new password/i) as HTMLInputElement;
    expect(field.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(field.type).toBe('text');
  });

  it('collapses back to the one-line affordance on cancel without calling the RPC', () => {
    renderReset();
    openForm();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('shows a busy state while the reset is in flight', async () => {
    let resolveRpc: (v: any) => void = () => {};
    mockRpc.mockReturnValue(new Promise((resolve) => { resolveRpc = resolve; }));
    renderReset();
    openForm();
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'freshpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));

    expect(await screen.findByText(/setting/i)).toBeInTheDocument();
    resolveRpc({ data: { id: 'p1', email: 'asha@corp.com', must_change_password: true }, error: null });
  });
});
