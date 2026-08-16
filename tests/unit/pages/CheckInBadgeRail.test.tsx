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
    // Filled by `attachHostNames` on the hooks that feed this frame, which is
    // why the pass can print them without an extra query.
    host: { full_name: 'D. Kumar' },
    department: { name: 'Information Technology' },
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

  // NO PHOTO ON THE PASS AT ALL (client instruction, 2026-08-16), and neither
  // is there an initials monogram standing in for one — a placeholder holds a
  // place for something that is coming, and nothing is coming. Asserted for
  // both shapes of the column, because the row reaches this rail with the
  // capture on `photo_data` (raw) or on `photo_url` (mapped by useTodayVisits /
  // useGateActivity) depending on which hook fed it, and only checking one
  // would let the other quietly print a headshot again.
  it('prints no photo and no initials monogram, whichever column carries it', () => {
    const { container, rerender } = renderRail({
      activeVisit: visit({ photo_url: 'https://example.test/p.webp' }),
    });
    expect(screen.queryByAltText('Sarah Whitfield')).toBeNull();
    expect(screen.queryByText('SW')).toBeNull();

    rerender(
      <CheckInBadgeRail
        activeVisit={visit({ photo_data: 'data:image/png;base64,abc' })}
        qrDataUrl={null}
        onPrintBadge={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByAltText('Sarah Whitfield')).toBeNull();
    expect(screen.queryByText('SW')).toBeNull();
    // The only image the pass may carry is the QR (and the issuing wordmark).
    const alts = Array.from(container.querySelectorAll('img')).map((i) => i.getAttribute('alt'));
    expect(alts).not.toContain('Sarah Whitfield');
  });

  // The two facts the pass was missing until 2026-08-16: a badge found on a
  // corridor floor named the visitor and nothing about where they were due.
  it('carries the person to meet and their department', () => {
    renderRail();
    expect(screen.getByText('Person to Meet')).toBeInTheDocument();
    expect(screen.getByText('Department')).toBeInTheDocument();
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
