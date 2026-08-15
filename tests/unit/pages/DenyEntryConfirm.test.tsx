import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import DenyEntryConfirm from '../../../src/pages/Guard/DenyEntryConfirm';
import type { ReportVisit } from '../../../src/lib/reportRow';

// The client's explicit requirement: only once the guard provides a
// justification can they deny entry. "Refuse entry" must not be a warning the
// guard can click past — it is the only route to the write, and it stays
// disabled until a reason is typed.

afterEach(cleanup);

function visit(over: Partial<ReportVisit> = {}): ReportVisit {
  return {
    id: 'v1',
    ref_number: 'VIS-20260815-0001',
    status: 'approved',
    visitor: { full_name: 'A. Kapoor' },
    ...over,
  } as unknown as ReportVisit;
}

describe('DenyEntryConfirm', () => {
  it('has the confirm button disabled on open', () => {
    render(<DenyEntryConfirm visit={visit()} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /refuse entry/i })).toBeDisabled();
  });

  it('enables the confirm button once a reason is typed', () => {
    render(<DenyEntryConfirm visit={visit()} onConfirm={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/reason for refusing entry/i), {
      target: { value: 'no photo ID produced' },
    });
    expect(screen.getByRole('button', { name: /refuse entry/i })).toBeEnabled();
  });

  it('stays disabled for a reason shorter than the minimum', () => {
    render(<DenyEntryConfirm visit={visit()} onConfirm={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/reason for refusing entry/i), {
      target: { value: 'x' },
    });
    expect(screen.getByRole('button', { name: /refuse entry/i })).toBeDisabled();
  });

  it('calls onConfirm with the typed reason when clicked', () => {
    const onConfirm = vi.fn();
    render(<DenyEntryConfirm visit={visit()} onConfirm={onConfirm} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/reason for refusing entry/i), {
      target: { value: 'no photo ID produced' },
    });
    fireEvent.click(screen.getByRole('button', { name: /refuse entry/i }));
    expect(onConfirm).toHaveBeenCalledWith('no photo ID produced');
  });

  it('fires onClose from Cancel', () => {
    const onClose = vi.fn();
    render(<DenyEntryConfirm visit={visit()} onConfirm={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables the confirm button while busy', () => {
    render(<DenyEntryConfirm visit={visit()} onConfirm={vi.fn()} onClose={vi.fn()} busy />);
    fireEvent.change(screen.getByLabelText(/reason for refusing entry/i), {
      target: { value: 'no photo ID produced' },
    });
    expect(screen.getByRole('button', { name: /recording/i })).toBeDisabled();
  });
});
