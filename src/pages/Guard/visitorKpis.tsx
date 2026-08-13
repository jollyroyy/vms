import React from 'react';
import type { VisitorSegment } from '../../lib/visitorSegments';
import type { KpiTileSpec } from '../../components/KpiTile';
import { glyph, USERS, WALKING, CALENDAR_CHECK, DOOR_OUT, HOURGLASS } from './dashboardTiles';

// Look and copy for the Visitors page KPI rail, in one place so VisitorKpiRail
// stays a layout file and KpiTile stays a card.
//
// The tones follow the dashboard board (dashboardTiles.tsx): brand for the
// pre-booked lane, success for who is on site, accent for the walk-in lane,
// orange for something owed a human's attention. A hue only means something if
// it means the same thing on every screen.

// A list: everything on the board, no filter.
const LIST = ['M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5'];
const PLUS = ['M12 4.5v15m7.5-7.5h-15'];

// No Overstaying tile (removed 2026-08-13, client instruction). It lives on
// the guard DASHBOARD, which is the board for things that need chasing; here it
// was a second door into a subset of Inside. The dashboard tile is still the
// only live mechanism for catching a forgotten check-out, so do not remove
// that one too.
export const VISITOR_KPI_ORDER: VisitorSegment[] = [
  'all', 'expected', 'inside', 'pending', 'walkinApproved', 'checkedOut', 'walkin',
];

export const VISITOR_KPIS: Record<VisitorSegment, KpiTileSpec> = {
  all: {
    label: 'All Visitors', hint: 'Everyone on this board',
    tone: 'text-navy-800', tint: 'var(--c-navy-200)', icon: glyph(...LIST),
  },
  expected: {
    label: 'Expected', hint: 'Booked ahead, not yet arrived',
    tone: 'text-brand-600', tint: 'var(--c-brand-100)', icon: glyph(...CALENDAR_CHECK),
  },
  inside: {
    label: 'Currently Inside', hint: 'Right now',
    tone: 'text-success-600', tint: 'var(--c-success-100)', icon: glyph(...USERS),
  },
  pending: {
    // Orange, matching the no-show tile's "owed a human's attention" colour —
    // a walk-in waiting on a host is exactly that.
    label: 'Pending Approval', hint: 'Walk-ins waiting on a host',
    tone: 'text-orange-600 dark:text-orange-300', tint: '255 237 213', icon: glyph(...HOURGLASS),
  },
  walkinApproved: {
    label: 'Approved Walk-ins', hint: 'Approved at the gate, not yet in',
    tone: 'text-accent-600 dark:text-accent-300', tint: '250 232 217', icon: glyph(...WALKING),
  },
  checkedOut: {
    label: 'Checked Out', hint: 'Came and left today',
    tone: 'text-navy-500', tint: 'var(--c-navy-200)', icon: glyph(...DOOR_OUT),
  },
  walkin: {
    // An action, not a count: the walk-in register is a form, and the tile
    // opens it. No numeral — KpiTile hides it when value is null.
    label: 'Walk-in Register', hint: 'Register an unannounced arrival',
    tone: 'text-brand-600', tint: 'var(--c-brand-100)', icon: glyph(...PLUS),
  },
};
