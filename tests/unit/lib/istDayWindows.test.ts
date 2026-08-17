import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { istDayStart, istDateKey } from '../../../src/lib/visitExpiry';

// "TODAY" IS AN IST DAY, AND NO SCREEN MAY DERIVE IT FROM A UTC DATE KEY.
//
// `new Date().toISOString().slice(0, 10)` is the UTC date. Pasted into a
// timestamp bound as `${key}T00:00:00Z` it is wrong in BOTH directions and
// never merely off by a rounding: for most of the IST day that bound resolves
// to 05:30 IST, so every visit between midnight and 05:30 IST — the night
// shift, the exact hours a guard is most likely to be reading the screen — is
// missing from "today"; and between 00:00 and 05:30 IST the key is yesterday's,
// so the window silently reaches back a further twenty-four hours.
//
// `lib/visitExpiry.ts` owns the answer (`istDayStart` / `istDateKey`) and is
// the one place the offset is defined. This is a SOURCE guard rather than a
// behavioural one because the defect is a spelling that keeps being retyped at
// new call sites — six of them had it at once — and a per-page test can only
// catch the pages somebody remembered to write a page test for.
const ROOTS = ['src/pages', 'src/components'];

// visitExpiry.ts itself, refNumber.ts (a date STAMP in a reference, not a
// window) and demoSeed.ts (a dev-only fixture writer) are the deliberate
// exceptions and live outside the scanned roots.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** Comments say the words on purpose — several files explain this very trap. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('IST day windows', () => {
  it('istDayStart is IST midnight, which is 18:30 UTC the day before', () => {
    // 2026-08-17T09:00:00Z is 14:30 IST on the 17th.
    const start = istDayStart(new Date('2026-08-17T09:00:00Z'));
    expect(start.toISOString()).toBe('2026-08-16T18:30:00.000Z');
    // The trap this guards: the UTC key would have produced 00:00Z on the 17th,
    // which is 05:30 IST — five and a half hours of the day already gone.
    expect(start.toISOString()).not.toBe('2026-08-17T00:00:00.000Z');
  });

  it('istDateKey disagrees with the UTC date before 05:30 IST', () => {
    const at = new Date('2026-08-17T00:30:00Z'); // 06:00 IST on the 17th
    expect(istDateKey(at)).toBe('2026-08-17');
    const earlyIst = new Date('2026-08-16T19:00:00Z'); // 00:30 IST on the 17th
    expect(istDateKey(earlyIst)).toBe('2026-08-17');
    expect(earlyIst.toISOString().slice(0, 10)).toBe('2026-08-16');
  });

  it('no query bounds an IST day with a UTC midnight or a 23:59:59 ceiling', () => {
    // `${key}T00:00:00Z` is 05:30 IST; `T23:59:59Z` both stops 5h30m short of
    // the IST day's end and drops its final second. `rangeBounds` is the one
    // definition of what a calendar day covers.
    // `reportsDateRange.ts` is the definition itself: it parses and formats
    // date KEYS in UTC on purpose, which is correct precisely because a key is
    // a calendar day and not a moment. `demoSeed.ts` writes dev fixtures.
    const allowed = /reportsDateRange\.ts$|demoSeed\.ts$/;
    const roots = [...ROOTS, 'src/lib'];
    const offenders = roots.flatMap(sourceFiles).filter((file) =>
      !allowed.test(file) && /T(00:00:00|23:59:59)Z`/.test(stripComments(readFileSync(file, 'utf8'))),
    );
    expect(offenders).toEqual([]);
  });

  it('no page or component derives a day from the UTC date key', () => {
    const offenders = ROOTS.flatMap(sourceFiles).filter((file) =>
      /toISOString\(\)\s*\.\s*slice\(0,\s*10\)/.test(stripComments(readFileSync(file, 'utf8'))),
    );
    expect(offenders).toEqual([]);
  });
});
