import type { BadgePrintRow } from './useBadgePrints';

// The Badge Printing tab's three tile figures, derived here and nowhere else —
// `guardTiles.ts`'s rule again: a tile's number and the table it sits above
// must come from one array, or a tile reading 3 could sit over a table
// holding five rows with nothing forcing the two into agreement.
//
// All three take the SAME array — `useBadgePrints(range)`'s ranged fetch — so
// there is no second, wider fetch a tile could disagree with the table over.
//
// UN-SUFFIXED SINCE THE TAB WENT HISTORICAL (client instruction, 2026-08-17).
// The fields used to be `printedToday` / `reprintsToday` / `visitorsBadgedToday`,
// which was exactly true while the hook's only window was `istDayStart()`. Once
// the window became an admin-chosen range, "Today" in a field name that can
// legitimately hold ninety days of prints is a lie the type itself would keep
// telling — the field name promised something the caller no longer controls.

export type BadgeKpis = {
  printed: number;
  reprints: number;
  /** Distinct visits badged, not distinct prints — a visitor badged twice
   *  (a reprint) is one visitor, not two, and "Visitors Badged" is asking how
   *  many people, not how many pieces of card stock. */
  visitorsBadged: number;
};

export function badgeKpis(prints: BadgePrintRow[]): BadgeKpis {
  return {
    printed: prints.length,
    reprints: prints.filter((p) => p.badge_type === 'reprint').length,
    visitorsBadged: new Set(prints.map((p) => p.visit_id)).size,
  };
}
