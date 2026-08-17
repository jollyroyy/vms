// Regression guard for the inverted-navy-scale contrast bug (see CLAUDE.md
// "Top-bar clock contrast + timezone" / AppShell.tsx's TopbarClock comment).
//
// `--c-navy-N` is redefined per theme in src/styles/tokens.css, and the two
// blocks do NOT move in the same direction: in light mode a low N is light
// and a high N is dark (normal), but in dark mode a low N is dark and a high
// N is light — the block is inverted relative to its own numbering, on
// purpose, so the SAME class name still means "ink" / "muted" / "background"
// in both themes. That means writing `dark:text-navy-M` with an M SMALLER
// than the base `text-navy-N` pulls the dark-mode colour toward the low,
// dark end of the dark-mode block — the opposite of what a `dark:` override
// on a light-mode-authored colour should ever do. That is exactly the bug
// TopbarClock had (`text-navy-500 dark:text-navy-300`, unreadable on the
// dark topbar) and it is fixed by DROPPING the `dark:` override, not by
// picking a different low number.
//
// Scope is `src/components/**` only. The wider `src/` tree (pages/, styles/)
// still carries known pre-existing instances of this pattern and is
// deliberately out of scope here — see CLAUDE.md. The KNOWN_VIOLATIONS list
// below is every instance already present in src/components/** at the time
// this guard was written (2026-08-15); it is not an endorsement, it is a
// grandfathered baseline so this test can fail on anything NEW without
// having to rewrite ~30 pre-existing call sites in the same pass. Shrinking
// the list is welcome; growing it is the regression this test exists to
// catch.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const COMPONENTS_DIR = resolve(__dirname, '../../../src/components');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(p);
  }
  return out;
}

// Matches a className attribute's literal string/template value only — never
// arbitrary quoted text elsewhere in the file (a code comment describing the
// old buggy class string must not itself trip this guard).
const CLASSNAME_RE = /className\s*=\s*(?:\{\s*`([^`]*)`\s*\}|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\}|"([^"]*)"|'([^']*)')/g;

type Violation = { file: string; line: number; base: number; dark: number; classes: string };

function findViolations(): Violation[] {
  const violations: Violation[] = [];
  for (const file of walk(COMPONENTS_DIR)) {
    const content = readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    CLASSNAME_RE.lastIndex = 0;
    while ((m = CLASSNAME_RE.exec(content))) {
      const value = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '';
      if (!/dark:text-navy-\d+/.test(value)) continue;
      const baseMatch = value.match(/(?<!dark:)text-navy-(\d+)/);
      const darkMatch = value.match(/dark:text-navy-(\d+)/);
      if (!baseMatch || !darkMatch) continue;
      const base = parseInt(baseMatch[1], 10);
      const dark = parseInt(darkMatch[1], 10);
      if (dark < base) {
        const line = content.slice(0, m.index).split('\n').length;
        const relative = file.slice(COMPONENTS_DIR.length).split(sep).join('/');
        violations.push({
          file: relative,
          line,
          base,
          dark,
          classes: value.trim(),
        });
      }
    }
  }
  return violations.sort((a, b) => (a.file + a.line).localeCompare(b.file + b.line));
}

// Grandfathered baseline — see file header. Each entry is `path:line`.
// Badge.tsx and VisitorDetails.tsx left this list on 2026-08-15 — every
// `dark:text-navy-*` in them was deleted rather than re-listed while both files
// were being worked on. Shrinking the baseline is the point of having one.
const KNOWN_VIOLATIONS = new Set([
  '/CardField.tsx:21', '/CardField.tsx:22',
  '/DailyVisitorAddForm.tsx:37',
  '/DailyVisitorCard.tsx:44', '/DailyVisitorCard.tsx:47',
  '/DailyVisitors.tsx:138',
  '/DemoDataPanel.tsx:67', '/DemoDataPanel.tsx:75', '/DemoDataPanel.tsx:102',
  '/DocumentSign.tsx:107',
  // Shifted 91/149/165 -> 88/150/166 on 2026-08-17: the admin console rebuild
  // deleted the sidebar's live-analytics widget, which moved the lines around
  // it. The call sites themselves are unchanged.
  '/layout/Sidebar.tsx:88', '/layout/Sidebar.tsx:150', '/layout/Sidebar.tsx:166',
  // SidebarAnalytics.tsx is DELETED (2026-08-17) — two entries left the
  // baseline with it. That is the list shrinking, which is the direction this
  // guard wants.
  '/layout/SidebarProfile.tsx:51', '/layout/SidebarProfile.tsx:75',
  '/PhotoCapture.tsx:134',
  '/SessionTimeout.tsx:104',
  // Moved 55 -> 72 on 2026-08-17 when the timeline's single `showTimestamps`
  // gate was split into `showAudit` / `showArrival`. Same line of markup, same
  // grandfathered violation — only its line number changed.
  '/VisitorDetailsTimeline.tsx:86',
]);

describe('src/components/** — no inverted dark:text-navy pair', () => {
  it('every violation found is already on the grandfathered baseline (no NEW ones)', () => {
    const violations = findViolations();
    const unexpected = violations.filter((v) => !KNOWN_VIOLATIONS.has(`${v.file}:${v.line}`));
    const detail = unexpected
      .map((v) => `${v.file}:${v.line} base=text-navy-${v.base} dark:text-navy-${v.dark} "${v.classes}"`)
      .join('\n');
    expect(unexpected, `New inverted dark:text-navy pair(s) found:\n${detail}`).toEqual([]);
  });

  it('the baseline is not stale — every listed line still exists and is still a violation', () => {
    const violations = findViolations();
    const found = new Set(violations.map((v) => `${v.file}:${v.line}`));
    const stale = [...KNOWN_VIOLATIONS].filter((k) => !found.has(k));
    expect(stale, `Baseline entries no longer present — shrink KNOWN_VIOLATIONS:\n${stale.join('\n')}`).toEqual([]);
  });
});
