import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useEscapeKey } from '../../../src/lib/useEscapeKey';

afterEach(cleanup);

function Harness({ onEscape, active }: { onEscape: () => void; active?: boolean }) {
  useEscapeKey(onEscape, active);
  return <div>harness</div>;
}

describe('useEscapeKey', () => {
  it('calls the handler when Escape is pressed', () => {
    const onEscape = vi.fn();
    render(<Harness onEscape={onEscape} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const onEscape = vi.fn();
    render(<Harness onEscape={onEscape} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('does nothing when inactive', () => {
    const onEscape = vi.fn();
    render(<Harness onEscape={onEscape} active={false} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('removes its listener on unmount', () => {
    const onEscape = vi.fn();
    const { unmount } = render(<Harness onEscape={onEscape} />);
    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
  });
});
