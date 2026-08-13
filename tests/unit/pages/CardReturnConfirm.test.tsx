import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import CardReturnConfirm from '../../../src/pages/Guard/CardReturnConfirm';
import type { Visit } from '../../../src/types/index';

afterEach(() => cleanup());

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    status: 'checked_in',
    created_at: '2026-08-04T04:00:00Z',
    checked_in_at: '2026-08-04T04:05:00Z',
    checked_out_at: null,
    visitor: { full_name: 'Rahul Verma' } as any,
    ...overrides,
  } as unknown as Visit;
}

describe('CardReturnConfirm', () => {
  it('names the visitor leaving', () => {
    render(<CardReturnConfirm visit={visit()} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
  });

  it('shows the card number the guard must collect when one is on record', () => {
    render(<CardReturnConfirm visit={visit({ visitor_card_number: 'C-104' })} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('C-104')).toBeInTheDocument();
    expect(screen.getByLabelText(/card collected from visitor/i)).toBeInTheDocument();
  });

  // The gate: "did the card come back" is an explicit answer, never an
  // inference â€” the confirm stays disabled until the handover is ticked.
  it('stays disabled until the card is ticked back, then confirms', () => {
    const onConfirm = vi.fn();
    render(<CardReturnConfirm visit={visit({ visitor_card_number: 'C-104' })} onConfirm={onConfirm} onClose={vi.fn()} />);

    const confirm = screen.getByRole('button', { name: 'Complete Check Out' });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/card collected from visitor/i));
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('a visit with no card on record has no checkbox and confirms directly', () => {
    const onConfirm = vi.fn();
    render(<CardReturnConfirm visit={visit({ visitor_card_number: null })} onConfirm={onConfirm} onClose={vi.fn()} />);

    expect(screen.getByText('No card on record')).toBeInTheDocument();
    expect(screen.queryByLabelText('Card collected from visitor')).not.toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'Complete Check Out' });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Cancel closes without confirming', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<CardReturnConfirm visit={visit()} onConfirm={onConfirm} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});