import { describe, it, expect } from 'vitest';
import { kpiLabelClass, kpiLabelClassCompact } from '../../../src/lib/kpiLabelSize';
import { PANEL_SPEC } from '../../../src/lib/dashboardPanelSpec';
import { HOD_PANEL_SPEC } from '../../../src/lib/hodTiles';

// A KPI NAME IS ONE LINE (client instruction, 2026-08-18). The label no longer
// wraps, so the only thing that can make a long one fit is its size — and the
// size is derived from the string rather than passed in, so a caller cannot
// forget. These assertions pin the bands, and the last two pin the reason the
// bands exist: every label the app actually ships lands inside them.
describe('kpiLabelSize', () => {
  it("keeps the app's 13px eyebrow for a short label", () => {
    expect(kpiLabelClass('Expected')).toBe('text-[13px]');
    expect(kpiLabelClass('Checked Out')).toBe('text-[13px]');
  });

  it('steps down once for a medium label and once more for a long one', () => {
    expect(kpiLabelClass('Cards Not Returned')).toBe('text-[12px]');
    expect(kpiLabelClass('Awaiting Walk-in Approval')).toBe('text-[11px]');
    expect(kpiLabelClass('Entry Refused at the Gate')).toBe('text-[11px]');
  });

  it('floors at 11px — a label is an eyebrow, never fine print', () => {
    expect(kpiLabelClass('A'.repeat(200))).toBe('text-[11px]');
    expect(kpiLabelClassCompact('A'.repeat(200))).toBe('text-[11px]');
  });

  it("runs one step tighter on the guard board's compact row", () => {
    expect(kpiLabelClassCompact('Expected')).toBe('text-[12px]');
    expect(kpiLabelClassCompact('Approved Walk-ins')).toBe('text-[11px]');
  });

  it('gives every live tile label a size in the band set', () => {
    const sizes = ['text-[13px]', 'text-[12px]', 'text-[11px]'];
    const labels = [
      ...Object.values(PANEL_SPEC).map((s) => s.heading),
      ...Object.values(HOD_PANEL_SPEC).map((s) => s.heading),
    ];
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(sizes).toContain(kpiLabelClass(label));
      expect(sizes).toContain(kpiLabelClassCompact(label));
    }
  });
});
