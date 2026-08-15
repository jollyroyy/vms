// The right-hand printable-pass section of the Live Queue check-in frame
// (src/pages/Guard/CheckInBadgeRail.tsx): the WHITE visitor pass, Print Badge,
// Back to Queue. No step list — the middle column's tracker is the only place
// the check-in stages are shown.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import CheckInBadgeRail from '../../../src/pages/Guard/CheckInBadgeRail';
import type { ReportVisit } from '../../../src/lib/reportRow';

afterEach(cleanup);

function visit(overrides: Partial<ReportVisit> = {}): ReportVisit {
  return {
    id: 'v1',
    ref_number: 'VIS-20260814-2417',
    status: 'checked_in',
    purpose: 'meeting',
    created_at: '2026-08-14T04:12:00Z',
    photo_data: null,
    visitor: { full_name: 'Sarah Whitfield', vendor_name: 'Whitfield & Partners' },
    ...overrides,
  } as unknown as ReportVisit;
}

function renderRail(props: Partial<React.ComponentProps<typeof CheckInBadgeRail>> = {}) {
  return render(
    <CheckInBadgeRail
      activeVisit={visit()}
      qrDataUrl={null}
      onPrintBadge={() => {}}
      onClose={() => {}}
      {...props}
    />,
  );
}

describe('CheckInBadgeRail', () => {
  // Removed 2026-08-14 (client instruction): the vertical rail restated the
  // middle column's tracker, and its "4. Print Badge / Pending" entry framed an
  // optional printout as an unfinished stage of the check-in.
  it('shows no step list at all', () => {
    renderRail();
    expect(screen.queryByText('Steps')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    ['1. Photo', '2. ID Scan', '3. Host Notified', '4. Print Badge'].forEach((label) => {
      expect(screen.queryByText(label)).toBeNull();
    });
    expect(screen.queryByText('Done')).toBeNull();
    expect(screen.queryByText('Pending')).toBeNull();
  });

  // base.css rewrites `.dark .bg-white` to a translucent dark glass, so a
  // Tailwind `bg-white` card renders DARK on this screen. The pass previews
  // something printed on paper, so its white is set explicitly and cannot be
  // themed away.
  it('paints the pass white with an explicit colour, not a themeable class', () => {
    const { container } = renderRail();
    const pass = container.querySelector('#vms-print-badge') as HTMLElement | null;
    expect(pass).not.toBeNull();
    expect(pass?.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(pass?.className).not.toContain('bg-white');
  });

  it('renders the pass identity: name and day pass number', () => {
    renderRail();
    expect(screen.getByText('Visitor Pass')).toBeInTheDocument();
    expect(screen.getByText('Sarah Whitfield')).toBeInTheDocument();
    expect(screen.getByText('Day Pass #2417')).toBeInTheDocument();
  });

  // "Valid until" is gone (client instruction, 2026-08-15). The pass is handed
  // to a visitor who is already inside; what a guard reading it back needs is
  // when this visit was booked for and when the person actually came through,
  // not a deadline the QR gate enforces on its own.
  it('prints no validity line', () => {
    renderRail();
    expect(screen.queryByText(/valid until/i)).toBeNull();
    expect(screen.queryByText(/valid till/i)).toBeNull();
  });

  // The mobile number is on the pass because the pass outlives the screen: if
  // the visitor is still on site at shift change, or the card comes back
  // without them, this is how the gate reaches them.
  it('prints the mobile number', () => {
    renderRail({ activeVisit: visit({ visitor: { full_name: 'Sarah Whitfield', phone: '9876543210' } as any }) });
    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
  });

  it('prints the scheduled time and the check-in time', () => {
    renderRail({
      activeVisit: visit({
        scheduled_for: '2026-08-14T04:30:00Z',
        checked_in_at: '2026-08-14T05:02:00Z',
      }),
    });
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Checked in')).toBeInTheDocument();
  });

  // A walk-in has no slot. "Anytime" rather than a dash — nobody booked them a
  // time, which is different from a time going unrecorded.
  it('says Anytime for a visit nobody scheduled', () => {
    renderRail({ activeVisit: visit({ scheduled_for: null, checked_in_at: '2026-08-14T05:02:00Z' }) });
    expect(screen.getByText('Anytime')).toBeInTheDocument();
  });

  // The exit time appears only once there is one: on a visitor still inside the
  // row would be a claim they had left.
  it('prints the check-out time only for a visitor who has left', () => {
    renderRail();
    expect(screen.queryByText('Checked out')).toBeNull();
    cleanup();
    renderRail({
      activeVisit: visit({
        status: 'checked_out',
        checked_in_at: '2026-08-14T05:02:00Z',
        checked_out_at: '2026-08-14T09:40:00Z',
      }),
    });
    expect(screen.getByText('Checked out')).toBeInTheDocument();
  });

  it('falls back to the visitor initials when no gate photo was captured', () => {
    renderRail();
    expect(screen.getByText('SW')).toBeInTheDocument();
  });

  // `photo_data` is the raw column and is often null on rows that came through
  // a hook, which map the capture onto `photo_url` (useTodayVisits,
  // useGateActivity). Reading only the raw column is why a visitor with a
  // perfectly good gate photo printed as two grey initials.
  it('shows the captured photo when the row carries it as photo_url', () => {
    renderRail({ activeVisit: visit({ photo_url: 'https://example.test/p.webp' }) });
    expect(screen.getByAltText('Sarah Whitfield')).toBeInTheDocument();
    expect(screen.queryByText('SW')).toBeNull();
  });

  it('shows the QR when one has been generated, and a placeholder otherwise', () => {
    const { rerender } = renderRail();
    expect(screen.getByText('QR')).toBeInTheDocument();
    rerender(
      <CheckInBadgeRail
        activeVisit={visit()}
        qrDataUrl="data:image/png;base64,abc"
        onPrintBadge={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByAltText('QR code')).toBeInTheDocument();
  });

  it('prints from Print Badge and closes the selection from Back to Queue', () => {
    const onPrintBadge = vi.fn();
    const onClose = vi.fn();
    renderRail({ onPrintBadge, onClose });
    fireEvent.click(screen.getByRole('button', { name: /print badge/i }));
    expect(onPrintBadge).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /back to queue/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
