import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import InstallAppButton from '../../src/components/InstallAppButton';

/**
 * "Install app" is offered by the APP only where the BROWSER has already
 * offered it. Everything below is about that one rule, because every way of
 * getting it wrong is silent: a button rendered unconditionally does nothing on
 * iOS and on every desktop, and a listener registered on mount misses the event
 * outright and renders nothing on the phone that could have installed it.
 */

/** Chrome's event, close enough for the two things the hook touches. */
function fireInstallable(): { prompted: () => number } {
  let prompts = 0;
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = () => { prompts += 1; return Promise.resolve(); };
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  act(() => { window.dispatchEvent(event); });
  return { prompted: () => prompts };
}

// The hook's store is module scope — one event captured stays captured — so
// each test starts by spending whatever a previous one left behind. cleanup()
// is explicit because this project's vitest config sets no `globals`, and
// without it RTL never registers its own afterEach and every render stacks.
beforeEach(() => {
  cleanup();
  act(() => { window.dispatchEvent(new Event('appinstalled')); });
});

describe('InstallAppButton', () => {
  it('renders nothing until the browser says the app is installable', () => {
    render(<InstallAppButton />);
    expect(screen.queryByRole('button', { name: /install app/i })).toBeNull();
  });

  it('appears once beforeinstallprompt has fired', () => {
    render(<InstallAppButton />);
    fireInstallable();
    expect(screen.getByRole('button', { name: /install app/i })).toBeTruthy();
  });

  it('is offered to a component that mounts AFTER the event', () => {
    // The whole reason the listener lives at module scope. Chrome fires this
    // once, early, and never re-dispatches it to a latecomer.
    fireInstallable();
    render(<InstallAppButton />);
    expect(screen.getByRole('button', { name: /install app/i })).toBeTruthy();
  });

  it('opens the browser dialog once and then stops offering', async () => {
    const { prompted } = fireInstallable();
    render(<InstallAppButton />);
    await act(async () => { screen.getByRole('button', { name: /install app/i }).click(); });
    expect(prompted()).toBe(1);
    // prompt() throws on a second call, so the control must not survive the
    // first press waiting for a second one.
    expect(screen.queryByRole('button', { name: /install app/i })).toBeNull();
  });

  it('disappears when the app is installed from the browser menu instead', () => {
    fireInstallable();
    render(<InstallAppButton />);
    expect(screen.getByRole('button', { name: /install app/i })).toBeTruthy();
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    expect(screen.queryByRole('button', { name: /install app/i })).toBeNull();
  });

  it('keeps its accessible name when the label is hidden', () => {
    // The collapsed sidebar renders the icon alone; an unlabelled control there
    // would be a button a screen reader announces as nothing.
    fireInstallable();
    render(<InstallAppButton showLabel={false} />);
    const button = screen.getByRole('button', { name: /install app/i });
    expect(button.textContent).toBe('');
  });
});
