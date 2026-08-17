// The categorical colours every chart in the app draws from, defined once.
//
// A hue is only information if it means the same thing on every screen. These
// are literal hex values rather than Tailwind classes because an SVG `fill`
// cannot take a utility class, and rather than CSS variables because the
// STATUS variables (--c-success-700 and friends) deliberately flip between
// themes — a green that becomes a different green in dark mode would make one
// slice of a donut change identity when the user toggles the theme, while the
// slice beside it stayed put.
//
// The first four are the app's own brand, success, warning and danger mid-tones
// — the same hues the mockup's reference screens use, which is why the palette
// needed no argument. The rest extend the run for charts with more series than
// the reference had: `VisitorPurpose` is a seven-member enum, so a purpose
// breakdown needs seven distinguishable fills and cannot borrow the four-colour
// picture.
//
// Ordered by how far apart adjacent pairs sit, so a two-series chart gets
// blue/green (unmistakable) rather than two neighbouring blues.

export const CHART_COLORS = [
  '#3b82f6', // brand-500   — blue
  '#22c55e', // success-500 — green
  '#f59e0b', // warning-500 — amber
  '#a855f7', // violet      — the reference screens' fourth slice
  '#ef4444', // danger-500  — red
  '#06b6d4', // cyan
  '#ec4899', // pink
] as const;

/** The colour for the nth series, wrapping rather than running out. */
export function chartColor(index: number): string {
  // `?? CHART_COLORS[0]` is unreachable — the modulo guarantees a hit — but the
  // compiler cannot know that, and a non-null assertion here would be a habit
  // worth not forming in a file every chart imports.
  return CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0];
}

// Axis furniture. Grid lines and tick labels must read on both themes without
// a second palette, so they are drawn as `currentColor` at low opacity by the
// chart components and these constants only carry the opacities.
export const GRID_OPACITY = 0.12;
export const AXIS_LABEL_CLASS = 'fill-navy-500 text-[10px] tabular-nums';

/**
 * Nice round axis maximum at or above `value`, so the top gridline is a number
 * a person would say out loud (50, not 47). Returns at least `floor` — an
 * all-zero series still needs a scale, or every bar divides by zero.
 */
export function axisMax(value: number, floor = 10): number {
  const target = Math.max(value, floor);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  for (const step of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= target) return Math.round(candidate);
  }
  return Math.round(10 * magnitude);
}

/** Evenly spaced tick values from 0 to `max`, inclusive, `count` gaps. */
export function axisTicks(max: number, count = 5): number[] {
  return Array.from({ length: count + 1 }, (_, i) => Math.round((max / count) * i));
}
