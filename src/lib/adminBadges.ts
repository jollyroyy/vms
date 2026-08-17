import type { BadgePrintRow } from './useBadgePrints';

// The Badge Printing tab's three tile figures, derived here and nowhere else —
// `guardTiles.ts`'s rule again: a tile's number and the table it sits above
// must come from one array, or a tile reading 3 could sit over a table
// holding five rows with nothing forcing the two into agreement.
//
// All three take the SAME array — `useBadgePrints(true)`'s today window — so
// there is no second, wider fetch a tile could disagree with the table over.

export type BadgeKpis = {
  printedToday: number;
  reprintsToday: number;
  /** Distinct visits badged, not distinct prints — a visitor badged twice
   *  (a reprint) is one visitor, not two, and "Visitors Badged" is asking how
   *  many people, not how many pieces of card stock. */
  visitorsBadgedToday: number;
};

export function badgeKpis(prints: BadgePrintRow[]): BadgeKpis {
  return {
    printedToday: prints.length,
    reprintsToday: prints.filter((p) => p.badge_type === 'reprint').length,
    visitorsBadgedToday: new Set(prints.map((p) => p.visit_id)).size,
  };
}
