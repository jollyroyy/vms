import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import OfflineBanner from '../../../src/components/OfflineBanner';

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

afterEach(() => {
  cleanup();
  setOnLine(true);
});

describe('OfflineBanner', () => {
  it('renders nothing at all while the connection is up', () => {
    setOnLine(true);
    const { container } = render(<OfflineBanner />);
    // Not a greyed-out chip and not a "connected" badge: a permanent status
    // light would be a fabricated fact the moment the signal dropped between
    // the render and somebody reading it. Same rule as OverstayAlertBanner.
    expect(container).toBeEmptyDOMElement();
  });

  it('says so when the app opened with no connection', () => {
    setOnLine(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
  });

  it('names the consequence, not just the state', () => {
    // The service worker falls navigations back to the cached shell, so the app
    // opens with every list empty — and an HOD cannot tell "no walk-ins
    // waiting" from a quiet morning unless the screen says which it is.
    setOnLine(false);
    render(<OfflineBanner />);
    expect(screen.getByText(/nothing on this screen is being updated/i)).toBeInTheDocument();
  });

  it('appears and clears with the browser events', () => {
    setOnLine(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).toBeNull();

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
