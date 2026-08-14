import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ModalCloseButton from '../../../src/components/ModalCloseButton';

afterEach(cleanup);

describe('ModalCloseButton', () => {
  it('renders a real button with aria-label "Close"', () => {
    render(<ModalCloseButton onClose={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('calls onClose when clicked', () => {
    const onClose = vi.fn();
    render(<ModalCloseButton onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stops the click from propagating to a backdrop behind it', () => {
    const onClose = vi.fn();
    const backdropClick = vi.fn();
    render(
      <div onClick={backdropClick}>
        <ModalCloseButton onClose={onClose} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(backdropClick).not.toHaveBeenCalled();
  });

  // The tones are asserted at full contrast (navy-600 / plain white), not the
  // faded navy-500 / white-80 they started as: a close control that is hard to
  // see is the bug this component was restyled to fix (2026-08-14).
  it('defaults to the light-surface tone', () => {
    render(<ModalCloseButton onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Close' }).className).toContain('text-navy-600');
  });

  it('renders the dark-header tone when requested', () => {
    render(<ModalCloseButton onClose={vi.fn()} variant="dark" />);
    expect(screen.getByRole('button', { name: 'Close' }).className).toContain('text-white');
  });

  it('is positioned top-right', () => {
    render(<ModalCloseButton onClose={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn.className).toContain('top-4');
    expect(btn.className).toContain('right-4');
  });
});
