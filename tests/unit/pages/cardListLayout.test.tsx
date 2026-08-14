// Client feedback, 2026-08-10: "show the cards in a horizontal manner, one
// row after another" — i.e. a vertical stack of full-width cards, never a
// 2-up/3-up grid. Pins the container classes for the two lists here that
// need no data fetching to render (WhosInside and GuardSearch, which DO fetch,
// have their own dedicated files mirroring their existing mock setups).
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import OverviewFilteredView from '../../../src/pages/HOD/OverviewFilteredView';
import type { Visit } from '../../../src/types/index';

function assertStackNotGrid(el: Element | null) {
  expect(el).not.toBeNull();
  expect(el!.className).not.toMatch(/\bgrid\b/);
  expect(el!.className).toMatch(/flex-col/);
}

describe('OverviewFilteredView — visitor list is a full-width stack, not a grid', () => {
  const baseVisit: Visit = {
    id: 'v1', ref_number: 'VIS-20260729-0001', visitor_id: 'vis1', department_id: 'dept1', host_id: 'h1',
    purpose: 'meeting', photo_path: null, photo_data: null, status: 'checked_in',
    checked_in_at: '2026-07-29T10:00:00Z', checked_out_at: null, exit_verified: null,
    rejection_reason: null, carrying_material: false, scheduled_for: null, grace_period_minutes: 30,
    created_at: '2026-07-29T09:00:00Z',
    visitor: {
      id: 'vis1', phone: '9999999999', full_name: 'John Doe', vendor_name: 'Acme Corp',
      id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null,
      created_at: '2026-07-29T09:00:00Z',
    },
    department: { id: 'dept1', name: 'Engineering', code: 'ENG', created_at: '2026-07-29T09:00:00Z' },
    host: { id: 'h1', full_name: 'Jane Smith' },
    photo_url: undefined,
  } as Visit;

  it('renders the visitor list as flex-col, not a multi-column grid', () => {
    const { container } = render(
      <OverviewFilteredView mode="inside" visits={[baseVisit]} loading={false} onClearFilter={vi.fn()} />,
    );
    const list = container.querySelector('[data-card-list]');
    assertStackNotGrid(list);
  });
});
