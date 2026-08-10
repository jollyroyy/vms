import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import SuccessPopup from '../../../src/components/SuccessPopup';

afterEach(cleanup);

function setup() {
  const onClose = vi.fn();
  render(
    <SuccessPopup title="Visitor Pre-Approved" message="Ref: VIS-1" onClose={onClose}>
      <div>child content</div>
    </SuccessPopup>,
  );
  return { onClose };
}

describe('SuccessPopup — closing', () => {
  it('renders a corner Close button', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('clicking Close calls onClose', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape calls onClose', () => {
    const { onClose } = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop calls onClose, clicking inside does not', () => {
    const { onClose } = setup();
    fireEvent.click(document.querySelector('.modal-content')!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('.modal-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('still renders the child content (e.g. the pass preview)', () => {
    setup();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });
});
