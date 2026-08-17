// Light-mode legibility of the notifications dropdown (client report,
// 2026-08-17: "improve the text visibility of notification area for light
// mode in all views").
//
// The panel paints `bg-white` in light mode, and it was authored dark-first:
// the heading and every notification title carried a hardcoded `text-white`,
// so they were RENDERED AND INVISIBLE — not merely low-contrast — and the
// separators were `white/10` on that same white. A rendering test cannot read
// a computed colour under jsdom (no stylesheet is applied), so these assert on
// the CLASS CONTRACT instead, which is the thing that actually regressed and
// the thing a future edit would reintroduce.
//
// It lives beside NotificationBell.test.tsx rather than inside it: that file
// is at 273 lines and this project caps a file at 300, with no exemption for
// tests.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import NotificationBell from '../../../src/components/NotificationBell';

const mockLimit = vi.hoisted(() => vi.fn());
const mockChannel = vi.hoisted(() => vi.fn());
const mockRemoveChannel = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockOn = vi.hoisted(() => vi.fn());
const mockSubscribe = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    })),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

const notification = {
  id: 'n1',
  recipient_id: 'user-1',
  type: 'visit_pending_approval' as const,
  title: 'New Visit Request',
  body: 'A visitor is waiting for your approval.',
  related_id: 'visit-1',
  is_read: false,
  created_at: new Date().toISOString(),
};

function setupMocks(data: unknown[] = [notification]) {
  mockLimit.mockResolvedValue({ data, error: null });
  mockChannel.mockReturnValue({ on: mockOn });
  mockOn.mockReturnValue({ subscribe: mockSubscribe });
  mockSubscribe.mockReturnValue('sub-1');
  mockRemoveChannel.mockResolvedValue(undefined);
}

/** Every class name inside the panel.
 *
 *  Read through `getAttribute`, never `el.className`: on an SVG element
 *  `className` is an `SVGAnimatedString`, not a string, so a `.test()` on it
 *  silently matches nothing and a `.matchAll()` throws — and this panel
 *  contains two SVGs. */
function classNamesIn(panel: HTMLElement): string[] {
  return [...panel.querySelectorAll('*')].map((el) => el.getAttribute('class') ?? '');
}

/** Opens the dropdown and returns the panel element. */
async function openPanel(): Promise<HTMLElement> {
  render(<NotificationBell userId="user-1" role="hod" />);
  const bell = document.querySelector('button');
  if (bell) fireEvent.click(bell);
  const heading = await screen.findByText('Notifications');
  return heading.closest('div')!.parentElement as HTMLElement;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('NotificationBell — light-mode legibility', () => {
  // The exact defect: white ink on the white panel. `dark:text-white` is fine
  // and is not what this catches — only an UNQUALIFIED `text-white`, which
  // applies in light mode too.
  it('renders no unqualified text-white anywhere on the panel', async () => {
    setupMocks();
    const panel = await openPanel();
    const offenders = classNamesIn(panel).filter((c) => /(^|\s)text-white(\s|$)/.test(c));
    expect(offenders).toEqual([]);
  });

  it('gives the panel heading and each notification title a navy ink step', async () => {
    setupMocks();
    await openPanel();
    expect(screen.getByText('Notifications').className).toMatch(/text-navy-950/);
    expect(screen.getByText('New Visit Request').className).toMatch(/text-navy-950/);
  });

  // The navy scale is INVERTED between themes, so one step already resolves to
  // the correct end at both. A `dark:text-navy-*` override on this panel would
  // be the bug the topbar clock had, not a fix for it.
  it('carries no dark:text-navy override on the panel', async () => {
    setupMocks();
    const panel = await openPanel();
    const offenders = classNamesIn(panel).filter((c) => /dark:text-navy-/.test(c));
    expect(offenders).toEqual([]);
  });

  // `navy-300` in light mode is rgb(199,193,180) — about 1.9:1 on white, which
  // is the timestamp and the empty-state subtitle being technically present
  // and practically unreadable.
  it('uses no navy step lighter than 600 for text on the panel', async () => {
    setupMocks();
    const panel = await openPanel();
    const tooFaint = classNamesIn(panel)
      .flatMap((c) => [...c.matchAll(/(?:^|\s)text-navy-(\d+)/g)])
      .map((m) => Number(m[1]))
      .filter((step) => step < 600);
    expect(tooFaint).toEqual([]);
  });

  // The separators were `border-white/10` and `divide-white/8` — the second is
  // not even a real Tailwind value, so it emitted nothing at all and the rows
  // had no rule between them in either theme.
  it('separates rows with a surface hairline, not a white one', async () => {
    setupMocks();
    const panel = await openPanel();
    expect(panel.querySelector('.divide-white\\/8')).toBeNull();
    expect(panel.querySelector('ul')?.className).toMatch(/divide-surface-200/);
  });

  it('still shows the empty state, and its copy is legible too', async () => {
    setupMocks([]);
    await openPanel();
    const caughtUp = screen.getByText('You are all caught up.');
    expect(caughtUp.className).toMatch(/text-navy-600/);
    await waitFor(() => expect(screen.getByText('No notifications')).toBeInTheDocument());
  });
});
