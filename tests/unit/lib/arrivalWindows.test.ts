// "How many are due between 9 and 12?" — the Pre-Registered rail's summary
// (client instruction, 2026-08-15). Its own file rather than an extra describe
// in preRegisteredBoard.test.ts: that one is about who belongs on the board,
// this one is about slicing the board a guard already has.
//
// The invariant every test here defends is that the numbers ADD UP. The rail
// this replaced had two hardcoded windows, 09:00-12:00 and 12:00-17:00, so an
// 18:00 booking was on the board and in neither number, with nothing on screen
// admitting it — which is exactly the failure a summary must not have.
import { describe, it, expect } from 'vitest';
import { arrivalWindows, DAY_FROM, DAY_TO, WINDOW_HOURS } from '../../../src/lib/preRegisteredBoard';
import type { ReportVisit } from '../../../src/lib/reportRow';

/** IST hour → the ISO instant the row carries. IST is UTC+5:30. */
const atIst = (hour: number, minute = 0): string => {
  const utcMinutes = hour * 60 + minute - (5 * 60 + 30);
  const d = new Date(Date.UTC(2026, 7, 14, 0, 0, 0));
  d.setUTCMinutes(d.getUTCMinutes() + utcMinutes);
  return d.toISOString();
};

const v = (scheduled_for: string | null): ReportVisit =>
  ({ id: Math.random().toString(36), status: 'approved', scheduled_for } as unknown as ReportVisit);

describe('arrivalWindows — the day in equal blocks', () => {
  it('covers the gate day in WINDOW_HOURS blocks, with no gap and no overlap', () => {
    const { windows } = arrivalWindows([]);
    expect(windows[0].from).toBe(DAY_FROM);
    expect(windows[windows.length - 1].to).toBe(DAY_TO);
    windows.forEach((w, i) => {
      if (i > 0) expect(w.from).toBe(windows[i - 1].to);
      expect(w.to - w.from).toBeLessThanOrEqual(WINDOW_HOURS);
    });
  });

  it('labels each block from the same bounds it counts with', () => {
    const { windows } = arrivalWindows([]);
    const nine = windows.find((w) => w.from === 9);
    expect(nine?.label).toBe('09:00 – 12:00');
  });

  it('counts a 09:00-12:00 booking in that block and nowhere else', () => {
    const { windows } = arrivalWindows([v(atIst(10, 30))]);
    expect(windows.find((w) => w.from === 9)?.count).toBe(1);
    expect(windows.filter((w) => w.count > 0)).toHaveLength(1);
  });

  it('puts the boundary hour in the LATER block, never both', () => {
    // 12:00 belongs to 12:00-15:00. A booking counted twice would make the
    // rail's rows sum to more than the board holds.
    const { windows, total } = arrivalWindows([v(atIst(12, 0))]);
    expect(windows.find((w) => w.from === 9)?.count).toBe(0);
    expect(windows.find((w) => w.from === 12)?.count).toBe(1);
    expect(windows.reduce((n, w) => n + w.count, 0)).toBe(total);
  });

  it('counts an evening booking that the old two-window rail dropped', () => {
    const { windows } = arrivalWindows([v(atIst(18, 15))]);
    expect(windows.find((w) => w.from === 18)?.count).toBe(1);
  });

  it('reports a booking before the gate day as outside, not as zero', () => {
    const { windows, outside, unscheduled } = arrivalWindows([v(atIst(5, 0))]);
    expect(outside).toBe(1);
    expect(unscheduled).toBe(0);
    expect(windows.every((w) => w.count === 0)).toBe(true);
  });

  it('reports a booking after the gate day as outside', () => {
    expect(arrivalWindows([v(atIst(21, 30))]).outside).toBe(1);
  });

  it('reports a legacy pre-approval with no slot as unscheduled', () => {
    const { unscheduled, outside } = arrivalWindows([v(null)]);
    expect(unscheduled).toBe(1);
    expect(outside).toBe(0);
  });

  it('every visit lands in exactly one bucket — the blocks plus the leftovers equal the board', () => {
    const board = [
      v(atIst(7, 0)), v(atIst(9, 5)), v(atIst(11, 59)), v(atIst(12, 0)),
      v(atIst(16, 30)), v(atIst(20, 59)), v(atIst(4, 0)), v(atIst(23, 0)), v(null),
    ];
    const { windows, outside, unscheduled, total } = arrivalWindows(board);
    expect(total).toBe(board.length);
    expect(windows.reduce((n, w) => n + w.count, 0) + outside + unscheduled).toBe(total);
  });

  it('reads the hour in IST, not the browser timezone', () => {
    // 04:00Z is 09:30 IST — a morning arrival. Read as UTC it would fall in the
    // 03:00-06:00 range and be reported as outside the gate day entirely.
    const { windows, outside } = arrivalWindows([v('2026-08-14T04:00:00Z')]);
    expect(outside).toBe(0);
    expect(windows.find((w) => w.from === 9)?.count).toBe(1);
  });
});
