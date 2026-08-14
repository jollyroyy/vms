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

  it('renders the pass identity: name, day pass number and validity', () => {
    renderRail();
    expect(screen.getByText('Visitor Pass')).toBeInTheDocument();
    expect(screen.getByText('Sarah Whitfield')).toBeInTheDocument();
    expect(screen.getByText('Day Pass #2417')).toBeInTheDocument();
    expect(screen.getByText(/Valid until/)).toBeInTheDocument();
  });

  it('falls back to the visitor initials when no gate photo was captured', () => {
    renderRail();
    expect(screen.getByText('SW')).toBeInTheDocument();
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
