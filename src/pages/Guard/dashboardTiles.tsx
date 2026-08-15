import React from 'react';

// The icon glyphs shared by every KPI board in the app — the guard dashboard
// (lib/guardTiles.ts), the Visitors rail (visitorKpis.tsx), the HOD Overview
// (OverviewStatCards) and the admin/whos-inside stat cards. One set of path
// data, one glyph renderer, so two tiles that mean the same thing are drawn
// the same way.
//
// The glyphs follow the reference design — a door with an arrow going in for
// entries, a door with an arrow coming out for exits, two people for who is on
// site, a figure mid-stride for walk-ins, a struck-through calendar for
// no-shows, a struck-through shield for declined. The COLOURS do not follow it:
// the reference is blue/purple/green, this app is Quest Mall gold and bronze.
// A hue only means something if it means the same thing on every screen.
//
// There is no TILES table here (deleted 2026-08-15). The old six-tile drill
// system it described — `Record<DrillKey, Tile>` with per-tile labels, tints
// and copy, alongside lib/dashboardDrill.ts — was superseded by
// lib/guardTiles.ts (four tiles, one predicate each) and had no importers left;
// `TILES` and `dashboardDrill.ts` are both gone with it.

// Shared with the Visitors KPI rail (visitorKpis.tsx) so the two boards speak
// the same glyph language.
export const glyph = (...paths: string[]): React.ReactNode => (
  <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"
    strokeWidth={1.7} aria-hidden="true">
    {paths.map((d, i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />)}
  </svg>
);

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
export const CALENDAR_CHECK = [CALENDAR, 'M10 15.75l1.5 1.5 3-3.5'];
export const SHIELD_X = [
  'M11.303 2.89a1.5 1.5 0 011.394 0l6 3.15a.75.75 0 01.403.664v4.296c0 4.57-3.145 8.53-7.516 9.487a.75.75 0 01-.318 0C7.02 19.53 3.75 15.57 3.75 11v-4.296a.75.75 0 01.403-.664l6-3.15z',
  'M10 10l4 4m0-4l-4 4',
];
// An hourglass: the decision is someone else's, it is only waiting here.
export const HOURGLASS = [
  'M6.75 3h10.5',
  'M8.25 3v5.25L12 12l3.75-3.75V3',
  'M8.25 21h7.5',
  'M8.25 21v-5.25L12 12l3.75 3.75V21',
];
