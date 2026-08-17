// The chart palette and axis math every chart draws from (src/lib/chartPalette.ts).
import { describe, it, expect } from 'vitest';
import { chartColor, axisMax, axisTicks, CHART_COLORS } from '../../../src/lib/chartPalette';

describe('chartColor', () => {
  it('returns the nth colour directly', () => {
    expect(chartColor(0)).toBe(CHART_COLORS[0]);
    expect(chartColor(2)).toBe(CHART_COLORS[2]);
  });

  it('wraps rather than running out once the series is longer than the palette', () => {
    expect(chartColor(CHART_COLORS.length)).toBe(CHART_COLORS[0]);
    expect(chartColor(CHART_COLORS.length + 2)).toBe(CHART_COLORS[2]);
  });
});

describe('axisMax', () => {
  it('rounds up to a number a person would say out loud', () => {
    expect(axisMax(47)).toBe(50);
    expect(axisMax(101)).toBe(125);
  });

  it('returns the value itself when it is already a nice round number', () => {
    expect(axisMax(50)).toBe(50);
  });

  it('never returns 0 for an all-zero series — that would divide by zero on every bar', () => {
    expect(axisMax(0)).toBeGreaterThan(0);
    expect(axisMax(0)).toBe(10); // the default floor
  });

  it('respects a custom floor', () => {
    expect(axisMax(0, 5)).toBe(5);
    expect(axisMax(2, 5)).toBe(5);
  });

  it('is always at or above the input value', () => {
    for (const n of [1, 9, 33, 99, 999, 4321]) {
      expect(axisMax(n)).toBeGreaterThanOrEqual(n);
    }
  });
});

describe('axisTicks', () => {
  it('produces count+1 evenly spaced values from 0 to max, inclusive', () => {
    expect(axisTicks(50, 5)).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('defaults to 5 gaps', () => {
    expect(axisTicks(100)).toHaveLength(6);
    expect(axisTicks(100)[5]).toBe(100);
  });
});
