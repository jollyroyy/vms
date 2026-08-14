// The Check-In Details card must show its values IN FULL.
//
// They used to render inside readOnly <input> elements, which are single-line
// boxes: a long vendor name or a host carrying their department after it was
// clipped with no ellipsis and no scrollbar, so a guard could not tell a cut
// value from a complete one. On the card whose entire job is identifying the
// person at the gate, that is the worst possible failure mode.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CheckInFrame from '../../../src/pages/Guard/CheckInFrame';
import type { ReportVisit } from '../../../src/lib/reportRow';

afterEach(cleanup);

const LONG_VENDOR = 'Whitfield & Partners Facilities Management Private Limited';
const LONG_HOST = 'Dharmendra Kumar Rajagopalan';

function visit(over: Partial<ReportVisit> = {}): ReportVisit {
  return {
    id: 'v1',
    ref_number: 'VIS-20260814-2417',
    status: 'checked_in',
    purpose: 'Meeting with D. Kumar',
    created_at: '2026-08-14T04:12:00Z',
    scheduled_for: '2026-08-14T05:00:00Z',
    checked_in_at: '2026-08-14T04:20:00Z',
    photo_data: null,
    remarks: null,
    visitor: {
      full_name: 'Sarah Whitfield',
      vendor_name: LONG_VENDOR,
      vehicle_number: 'KA 05 AB 1234',
      id_type: 'PAN',
      id_last4: '234F',
    },
    host: { full_name: LONG_HOST },
    department: { name: 'Information Technology' },
    ...over,
  } as unknown as ReportVisit;
}

function renderFrame(v: ReportVisit = visit()) {
  return render(
    <CheckInFrame
      activeVisit={v}
      qrDataUrl={null}
      onNotifyHost={() => {}}
      onPrintBadge={() => {}}
      onClose={() => {}}
    />,
  );
}

describe('CheckInFrame — the details are fully legible', () => {
  it('renders the visitor name, vendor and host in full, however long they are', () => {
    renderFrame();
    // The name also appears on the pass beside this card, hence getAllByText.
    expect(screen.getAllByText('Sarah Whitfield').length).toBeGreaterThan(0);
    expect(screen.getByText(LONG_VENDOR)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(LONG_HOST))).toBeInTheDocument();
  });

  // The regression guard: an <input> cannot wrap, so its value is clipped at
  // the box edge. These are read-only facts and must render as text.
  it('renders the fact values as wrapping text, never inside a single-line input', () => {
    const { container } = renderFrame();
    expect(container.querySelectorAll('input').length).toBe(0);
    const vendor = screen.getByText(LONG_VENDOR);
    expect(vendor.className).toContain('break-words');
  });

  it('keeps the host and their department on one value, both readable', () => {
    renderFrame();
    const host = screen.getByText(new RegExp(LONG_HOST));
    expect(host.textContent).toContain('Information Technology');
  });

  it('still falls back to an em dash when a fact is missing', () => {
    renderFrame(visit({ visitor: { full_name: 'Solo Visitor' } as never }));
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
