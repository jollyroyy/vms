// Shared class strings for the "crisp ring" card idiom used by the detail
// cards a guard/HOD scans in a list (WhosInsideVisitorCard, SearchResultCard,
// CheckInMatchCard). Current premium practice has moved from blurred drop
// shadows to sharp geometry: a single-pixel inset ring is the primary edge
// treatment, with a tight contact layer plus a thin ambient layer beneath —
// deliberate depth, never a blur-heavy glow. Hover strengthens the ring
// rather than blooming a shadow.
//
// Deliberately NOT applied to `.card` / `.card-hover` in
// components-surfaces.css — those are a separate, deliberate, well-tested
// layered-glass treatment used across most of the rest of the app, and are
// left untouched. This is a second idiom, scoped to the cards rebuilt here.
//
// `motion-safe:` is Tailwind's own `@media (prefers-reduced-motion: no-preference)`
// variant — no JS/matchMedia call needed, so there is nothing to feature-detect
// or that can crash under jsdom.
const BASE =
  'rounded-2xl bg-white dark:bg-white/[0.07] ' +
  'ring-1 ring-inset ring-black/[0.09] dark:ring-white/[0.12] ' +
  'shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_-12px_rgba(15,23,42,0.18)] transition-[box-shadow] duration-200';

/** Static card — no click affordance (e.g. a card inside a modal or a non-interactive row). */
export const CRISP_CARD = BASE;

/** Clickable card: ring strengthens and the card lifts 1px on hover, both within the 150-300ms band. */
export const CRISP_CARD_INTERACTIVE =
  `${BASE} cursor-pointer transition-[box-shadow,transform] ` +
  'motion-safe:hover:-translate-y-px hover:ring-black/[0.12] dark:hover:ring-white/[0.14]';

/** The muted footer band — shadcn's CardFooter: a distinct surface, not a nested bordered box. */
export const CARD_FOOTER_BAND =
  'bg-surface-100/60 dark:bg-white/[0.05] border-t border-surface-200 dark:border-white/[0.08]';
