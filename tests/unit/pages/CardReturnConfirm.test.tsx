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

  // The number is printed TWICE on purpose — once as the value to read off the
  // physical card, once inside the label the guard is ticking — so the tick is
  // always made against a stated number rather than against the word "card".
  it('shows the card number the guard must collect when one is on record', () => {
    render(<CardReturnConfirm visit={visit({ visitor_card_number: 'C-104' })} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByText(/C-104/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/card C-104 collected from visitor/i)).toBeInTheDocument();
  });

  // The gate: "did the card come back" is an explicit answer, never an
  // inference â€” the confirm stays disabled until the handover is ticked.
  it('stays disabled until the card is ticked back, then confirms', () => {
    const onConfirm = vi.fn();
    render(<CardReturnConfirm visit={visit({ visitor_card_number: 'C-104' })} onConfirm={onConfirm} onClose={vi.fn()} />);

    const confirm = screen.getByRole('button', { name: 'Complete Check Out' });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/card C-104 collected from visitor/i));
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // THE TICK IS REQUIRED ON EVERY CHECK-OUT (client instruction, 2026-08-17).
  // This case used to render no checkbox and enable the button immediately. A
  // visit with no card on record is exactly the case worth an explicit answer:
  // the guard is asserting they looked, not being waved through because a
  // column happened to be null.
  it('still demands a tick when no card is on record', () => {
    const onConfirm = vi.fn();
    render(<CardReturnConfirm visit={visit({ visitor_card_number: null })} onConfirm={onConfirm} onClose={vi.fn()} />);

    expect(screen.getByText('No card on record')).toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'Complete Check Out' });
    expect(confirm).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/no visitor card was issued/i));
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // Belt to the braces above: neither branch may reach onConfirm untouched.
  it.each([['C-104'], [null]])('never confirms unticked (card %s)', (card) => {
    const onConfirm = vi.fn();
    render(<CardReturnConfirm visit={visit({ visitor_card_number: card })} onConfirm={onConfirm} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete Check Out' }));
    expect(onConfirm).not.toHaveBeenCalled();
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