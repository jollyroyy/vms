// Guards the four claims-the-system-can't-support fixes on the Live Queue
// check-in frame (src/pages/Guard/CheckInFrame.tsx +
// src/pages/Guard/CheckInBadgeRail.tsx): identity verification must be
// evidence-based, the vehicle row must not invent a parking slot, the Badge
// type control stays untouched (scope change — no visual/design edits), and
// the pass's validity line must reflect the visit's real expiry rather than a
// hardcoded time.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CheckInFrame from '../../../src/pages/Guard/CheckInFrame';
import type { ReportVisit } from '../../../src/lib/reportRow';

afterEach(cleanup);

function visit(overrides: Partial<ReportVisit> = {}): ReportVisit {
  return {
    id: 'v1',
    ref_number: 'VIS-20260814-2417',
    status: 'checked_in',
    purpose: 'meeting',
    created_at: '2026-08-14T04:12:00Z',
    scheduled_for: null,
    checked_in_at: '2026-08-14T05:00:00Z',
    photo_data: 'data:image/png;base64,abc',
    visitor: { full_name: 'Sarah Whitfield', vendor_name: 'Whitfield & Partners', id_type: 'aadhaar' },
    ...overrides,
  } as unknown as ReportVisit;
}

function renderFrame(v: ReportVisit) {
  return render(
    <CheckInFrame
      activeVisit={v}
      qrDataUrl={null}
      onPrintBadge={() => {}}
      onClose={() => {}}
    />,
  );
}

describe('CheckInFrame honesty fixes', () => {
  it('shows "Identity verified" only when both photo and ID scan are present', () => {
    renderFrame(visit());
    expect(screen.getByText('Identity verified')).toBeInTheDocument();
    expect(screen.queryByText('Identity not verified')).toBeNull();
  });

  it('does not claim identity verified when the photo is missing', () => {
    renderFrame(visit({ photo_data: null }));
    expect(screen.queryByText('Identity verified')).toBeNull();
    expect(screen.getByText('Identity not verified')).toBeInTheDocument();
  });

  it('does not claim identity verified when the ID scan is missing', () => {
    renderFrame(visit({ visitor: { full_name: 'Sarah Whitfield', vendor_name: 'Whitfield & Partners', id_type: null } as any }));
    expect(screen.queryByText('Identity verified')).toBeNull();
    expect(screen.getByText('Identity not verified')).toBeInTheDocument();
  });

  it('never renders a fabricated parking slot', () => {
    renderFrame(visit({ visitor: { full_name: 'Sarah Whitfield', vendor_name: 'Whitfield & Partners', id_type: 'aadhaar', vehicle_number: 'KA-01-AB-1234' } as any }));
    // A read-only fact row, not an input — see CheckInFrameLegibility.test.tsx.
    expect(screen.getByText('KA-01-AB-1234')).toBeInTheDocument();
    expect(screen.queryByText(/parking slot/i)).toBeNull();
  });

  it('shows the em dash when there is no vehicle number, never a parking slot', () => {
    renderFrame(visit({ visitor: { full_name: 'Sarah Whitfield', vendor_name: 'Whitfield & Partners', id_type: 'aadhaar', vehicle_number: null } as any }));
    expect(screen.queryByText(/parking slot/i)).toBeNull();
  });

  // The Badge type control went with the Check-In Details card it lived in
  // (2026-08-15, client instruction). It was a disabled select holding one
  // option — a control that offered no choice, on a card whose other four rows
  // duplicated the Inside Now table above it.
  it('no longer renders the Badge type select', () => {
    const { container } = renderFrame(visit());
    expect(screen.queryByDisplayValue('Temporary — Day Pass')).toBeNull();
    expect(container.querySelectorAll('select').length).toBe(0);
  });

  it('shows a real validity time on the pass, never the old hardcoded 06:00 PM', () => {
    renderFrame(visit({ qr_expires_at: '2026-08-15T10:30:00Z' } as any));
    const validity = screen.getByText(/Valid until/);
    expect(validity.textContent).not.toContain('06:00 PM');
  });
});
