import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ModalCloseButton from '../../../src/components/ModalCloseButton';

afterEach(cleanup);

describe('ModalCloseButton', () => {
  it('defaults to absolute positioning, not relative', () => {
    render(<ModalCloseButton onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn.className).toMatch(/\babsolute\b/);
    expect(btn.className).not.toMatch(/\brelative\b/);
  });

  it('inline renders as a normal flex child — relative and shrink-0, never absolute', () => {
    render(<ModalCloseButton onClose={() => {}} inline />);
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn.className).toMatch(/\brelative\b/);
    expect(btn.className).toMatch(/\bshrink-0\b/);
    expect(btn.className).not.toMatch(/\babsolute\b/);
  });

  it('calls onClose when clicked', () => {
    const onClose = vi.fn();
    render(<ModalCloseButton onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has aria-label="Close"', () => {
    render(<ModalCloseButton onClose={() => {}} />);
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });
});
