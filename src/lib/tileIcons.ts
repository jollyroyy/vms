// The KPI tile glyphs, in ONE place. They used to live inside
// pages/Guard/dashboardTileMeta.ts, which made them the guard board's private
// property — so when the HOD dashboard was brought onto the same design
// (client instruction, 2026-08-16: "the look and feel, font type and
// typography of the HOD view must be exactly the same as the guard's") the
// only way to reuse a glyph was to paste the path a second time. Two copies of
// a path is two chances for one board's "people" icon to drift from the
// other's, and a hue or a glyph is only information if it means the same thing
// on every screen.
//
// The palette rule travels with them: brand for the pre-booked lane, success
// for who is on site, warning for what is owed a human's attention, danger for
// a refusal.

export const ICON_CALENDAR =
  'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5';
export const ICON_CHECK_CIRCLE = 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
export const ICON_PEOPLE =
  'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z';
export const ICON_CLOCK = 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z';
export const ICON_LIST = 'M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5';
export const ICON_WALKING =
  'M13.5 6.75a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM9 21l2.25-4.5L9 13.5l1.5-4.5 3 1.5 2.25 2.25M11.25 16.5L15 21';
export const ICON_X_CIRCLE = 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
// A shield, not a second cross: a refusal at the door is a different event from
// a host's decline, and the two tiles sit side by side.
export const ICON_SHIELD_X =
  'M12 3l7.5 3v5.25c0 4.28-3.2 8.28-7.5 9.75-4.3-1.47-7.5-5.47-7.5-9.75V6L12 3zm-2.25 6.75l4.5 4.5m0-4.5l-4.5 4.5';
