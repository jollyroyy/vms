// The admin's half of taking a visitor off the blacklist: the panel that
// offers "Request removal" and the form that files the justification.
// Neither may ever clear `visitors.is_blacklisted` directly — see the header
// comment in src/lib/blacklistRemoval.ts. These tests pin that the admin
// surface can only ASK.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import AdminBlacklistPanel from '../../../src/pages/Admin/AdminBlacklistPanel';
import BlacklistRemovalForm from '../../../src/pages/Admin/BlacklistRemovalForm';
import type { Visitor } from '../../../src/types/index';

const requestBlacklistRemoval = vi.fn(async () => 'req-1');
vi.mock('../../../src/lib/blacklistRemoval', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/blacklistRemoval')>();
  return {
    ...actual,
    requestBlacklistRemoval: (...args: unknown[]) => requestBlacklistRemoval(...(args as [string, string])),
  };
});

function visitor(over: Partial<Visitor> = {}): Visitor {
  return {
    id: 'v1',
    phone: '9876543210',
    full_name: 'Priya Nair',
    vendor_name: null,
    id_type: null,
    id_last4: null,
    vehicle_number: null,
    is_blacklisted: true,
    blacklist_reason: 'Repeated policy violation',
    created_at: '2026-08-10T08:00:00Z',
    ...over,
  };
}

afterEach(() => {
  cleanup();
  requestBlacklistRemoval.mockClear();
});

describe('AdminBlacklistPanel', () => {
  it('shows a Request removal control and an Active status for a visitor with no open request', () => {
    render(
      <AdminBlacklistPanel
        visitors={[visitor()]}
        loading={false}
        awaitingCeo={new Set()}
        onRequestRemoval={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Request removal' })).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  // Offering the button here could only fail against the one-open-request
  // unique index — the row must say Awaiting CEO and offer nothing to press.
  it('shows Awaiting CEO and no Request removal button for a visitor with an open request', () => {
    render(
      <AdminBlacklistPanel
        visitors={[visitor()]}
        loading={false}
        awaitingCeo={new Set(['v1'])}
        onRequestRemoval={vi.fn()}
      />,
    );
    expect(screen.getByText('Awaiting CEO')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request removal' })).toBeNull();
  });

  it('renders no Request removal button for any row when onRequestRemoval is omitted', () => {
    render(
      <AdminBlacklistPanel
        visitors={[visitor(), visitor({ id: 'v2', full_name: 'Second Visitor' })]}
        loading={false}
        awaitingCeo={new Set()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Request removal' })).toBeNull();
  });

  it('calls onRequestRemoval with the visitor when the button is clicked', () => {
    const onRequestRemoval = vi.fn();
    const v = visitor();
    render(
      <AdminBlacklistPanel
        visitors={[v]}
        loading={false}
        awaitingCeo={new Set()}
        onRequestRemoval={onRequestRemoval}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Request removal' }));
    expect(onRequestRemoval).toHaveBeenCalledWith(v);
  });
});

describe('BlacklistRemovalForm', () => {
  function renderForm(over: Partial<Visitor> = {}) {
    return render(
      <BlacklistRemovalForm visitor={visitor(over)} onClose={vi.fn()} onFiled={vi.fn()} />,
    );
  }

  // Mirrors CardReturnConfirm's gate: the justification is the only route to
  // the write, never a warning a submitter could click past.
  it('keeps Send to CEO disabled until a justification of at least 10 characters is typed', () => {
    renderForm();
    const submit = screen.getByRole('button', { name: 'Send to CEO' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/why should this visitor/i), { target: { value: 'short' } });
    expect(screen.getByRole('button', { name: 'Send to CEO' })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/why should this visitor/i), {
      target: { value: 'Cleared after an internal review of the incident.' },
    });
    expect(screen.getByRole('button', { name: 'Send to CEO' })).not.toBeDisabled();
  });

  it('prints the reason the visitor is currently blacklisted', () => {
    renderForm({ blacklist_reason: 'Attempted theft at the gate' });
    expect(screen.getByText('Attempted theft at the gate')).toBeInTheDocument();
  });

  // The admin can only ASK — no control on this form may clear the flag
  // directly, since migration 091's trigger means nothing here could anyway.
  it('renders no control that would clear the blacklist flag directly', () => {
    renderForm();
    expect(screen.queryByText(/remove from blacklist|unblacklist/i)).toBeNull();
  });

  it('calls requestBlacklistRemoval with the visitor id and the typed justification', async () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText(/why should this visitor/i), {
      target: { value: 'Cleared after an internal review of the incident.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send to CEO' }));
    expect(requestBlacklistRemoval).toHaveBeenCalledWith('v1', 'Cleared after an internal review of the incident.');
  });
});
