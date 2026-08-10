import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ConfirmDialog from '../../../src/pages/Admin/ConfirmDialog';

afterEach(cleanup);

function setup(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      title="Delete Department?"
      message="Are you sure?"
      confirmLabel="Delete"
      busyLabel="Deleting…"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmDialog — closing', () => {
  it('renders a corner Close button', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('clicking Close cancels — it never confirms the destructive action', () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape cancels, never confirms', () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clicking the backdrop cancels', () => {
    const { onCancel } = setup();
    fireEvent.click(document.querySelector('.modal-overlay')!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the dialog does not cancel', () => {
    const { onCancel } = setup();
    fireEvent.click(document.querySelector('.modal-content')!);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('the Close button is a real, keyboard-reachable <button type="button">', () => {
    setup();
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'button');
  });
});
