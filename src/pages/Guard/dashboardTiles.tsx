import React from 'react';
import type { DrillKey } from '../../lib/dashboardDrill';

// Look and copy for the eight KPI tiles, in one place so DashboardSummary
// stays a layout file and DashboardTile stays a card.
//
// The glyphs follow the reference design — a door with an arrow going in for
// entries, a door with an arrow coming out for exits, two people for who is on
// site, a figure mid-stride for walk-ins, a struck-through calendar for
// no-shows, a struck-through shield for declined. The COLOURS do not follow it:
// the reference is blue/purple/green, this app is Quest Mall gold and bronze,
// and every tone below is the one that tile already carried. A hue only means
// something if it means the same thing on every screen.
//
// `tint` is an rgb TRIPLE, not a colour — components-dashboard.css composes it
// with an alpha for the icon plate. Token vars wherever one exists, so both
// themes follow; the two static triples (bronze, orange) match the static text
// shades those tiles already used.

type Tile = {
  label: string;
  /** Optional qualifier under the label. Omitted where it would only repeat
   *  the section heading — the grid already sits under "Today", so a tile
   *  reading "Today" underneath it says nothing the guard has not just read. */
  hint?: string;
  /** Text colour of the numeral. */
  tone: string;
  /** rgb triple driving the icon plate. */
  tint: string;
  icon: React.ReactNode;
};

// Shared with the Visitors KPI rail (visitorKpis.tsx) so the two boards speak
// the same glyph language.
export const glyph = (...paths: string[]): React.ReactNode => (
  <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"
    strokeWidth={1.7} aria-hidden="true">
    {paths.map((d, i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />)}
  </svg>
);

export const DOOR_IN = ['M15 3.75h2.25A2.25 2.25 0 0119.5 6v12a2.25 2.25 0 01-2.25 2.25H15', 'M12 15l3-3m0 0l-3-3m3 3H4.5'];
export const DOOR_OUT = ['M15 3.75H6.75A2.25 2.25 0 004.5 6v12a2.25 2.25 0 002.25 2.25H15', 'M16.5 15l3-3m0 0l-3-3m3 3H9'];
export const USERS = ['M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z'];
// A figure mid-stride: head, torso, the two arms, the two legs.
export const WALKING = [
  'M14.25 4.5a1.75 1.75 0 11-3.5 0 1.75 1.75 0 013.5 0z',
  'M12.25 7.75l-2.5 4.5',
  'M12.25 7.75l2.5 1.75.5 3',
  'M9.75 12.25l2.75 2 .5 6',
  'M9.75 12.25L6.5 16.5',
  'M11.75 8.25L8.25 10',
];
export const CALENDAR = 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5';
export const CALENDAR_X = [CALENDAR, 'M10 13.75l4 4m0-4l-4 4'];
export const CALENDAR_CHECK = [CALENDAR, 'M10 15.75l1.5 1.5 3-3.5'];
export const SHIELD_X = [
  'M11.303 2.89a1.5 1.5 0 011.394 0l6 3.15a.75.75 0 01.403.664v4.296c0 4.57-3.145 8.53-7.516 9.487a.75.75 0 01-.318 0C7.02 19.53 3.75 15.57 3.75 11v-4.296a.75.75 0 01.403-.664l6-3.15z',
  'M10 10l4 4m0-4l-4 4',
];
export const CLOCK = ['M12 6.75v5.25l3.25 2', 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z'];
// An hourglass: the decision is someone else's, it is only waiting here.
export const HOURGLASS = [
  'M6.75 3h10.5',
  'M8.25 3v5.25L12 12l3.75-3.75V3',
  'M8.25 21h7.5',
  'M8.25 21v-5.25L12 12l3.75 3.75V21',
];

// Row 1 reads as the gate's traffic (in, out, who is left); row 2 as the
// things still owed a human's attention.
export const TILES: Record<DrillKey, Tile> = {
  entered: {
    label: 'Entries', tone: 'text-navy-800', tint: 'var(--c-navy-200)',
    icon: glyph(...DOOR_IN),
  },
  checkedOut: {
    label: 'Exits', tone: 'text-navy-500', tint: 'var(--c-navy-200)',
    icon: glyph(...DOOR_OUT),
  },
  inside: {
    label: 'Currently Inside', hint: 'Right now', tone: 'text-success-600', tint: 'var(--c-success-100)',
    icon: glyph(...USERS),
  },
  preApproved: {
    label: 'Pre-approved', hint: 'Booked ahead, not yet arrived', tone: 'text-brand-600',
    tint: 'var(--c-brand-100)', icon: glyph(...CALENDAR_CHECK),
  },
  walkInApproved: {
    label: 'Walk-ins Approved', hint: 'Approved at the gate, not yet in',
    tone: 'text-accent-600 dark:text-accent-300', tint: '250 232 217', icon: glyph(...WALKING),
  },
  overstaying: {
    // Amber, not red. This is nearly always a check-out somebody forgot, not a
    // person refusing to leave — a red tile would have the guard hunting for an
    // intruder when the fix is to close a record.
    label: 'Overstaying', hint: 'Inside far longer than expected',
    tone: 'text-amber-600 dark:text-amber-300', tint: 'var(--c-warning-100)', icon: glyph(...CLOCK),
  },
  noShow: {
    // Same orange used for the `no_show` status badge (statusStyles.ts) so the
    // colour means the same thing everywhere. Orange is a static Tailwind hue,
    // not a token, so it needs an explicit dark: variant or it goes flat on a
    // dark card.
    label: 'No-shows', hint: 'Booked, never arrived',
    tone: 'text-orange-600 dark:text-orange-300', tint: '255 237 213', icon: glyph(...CALENDAR_X),
  },
  declined: {
    // NOT "Entry Denied", which is what the reference design called it.
    // `rejected` means an HOD declined the request, usually before the visitor
    // ever reached the gate. Printing "entry denied" on a guard's screen claims
    // the guard turned someone away at the door, which is a different event and
    // a much more serious one to have wrong.
    label: 'Declined', hint: 'Request declined by person to meet',
    tone: 'text-danger-600', tint: 'var(--c-danger-100)', icon: glyph(...SHIELD_X),
  },
};
