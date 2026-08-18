// A KPI LABEL IS ONE LINE (client instruction, 2026-08-18: "I want all the
// texts in the same line for all the KPI names").
//
// Every KPI card in this app is a fixed 13px uppercase eyebrow over a numeral.
// That is fine for "Expected" and hopeless for "Entry Refused at the Gate":
// inside a tile that spends 92–110px on padding, an icon plate and a chevron
// before a letter is drawn, the long labels wrapped to two and three lines, so
// a row of six tiles printed six labels of three different heights and the
// numerals under them no longer lined up. Wrapping is what the client is
// looking at when they say the cards are "not in the same line".
//
// The size is DERIVED FROM THE LABEL, never passed in — the same argument
// AdminKpiTile already makes for its numeral (`valueClass`): a caller who has
// to remember is exactly how the ragged tile got in, and the string is right
// there to be measured. One step down per length band, floor 11px, so the
// longest label in the app still reads as an eyebrow rather than as fine print.
//
// It is only half the fix: the grids were also capped so the widest label fits
// the narrowest tile it can land in (see GuardDashboardMain, HodKpiBoard and
// the admin boards). This function shrinks type; it cannot conjure width, and
// `.gate-tile` clips (`overflow-hidden`), so a board that goes six across at
// 1536px would hide the end of a label rather than wrap it — which is worse.

/** Length bands, longest first. Sizes in px, matched by DashboardTile,
 *  AdminKpiTile and KpiTile so one label reads the same on every board. */
export function kpiLabelClass(label: string): string {
  const n = label.length;
  if (n <= 14) return 'text-[13px]';
  if (n <= 20) return 'text-[12px]';
  return 'text-[11px]';
}

/** The secondary (compact) row of the guard board, one step tighter again. */
export function kpiLabelClassCompact(label: string): string {
  const n = label.length;
  if (n <= 14) return 'text-[12px]';
  return 'text-[11px]';
}
