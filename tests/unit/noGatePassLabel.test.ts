// 2026-08-10 client instruction: "don't mention gate pass anywhere in the
// visitor management system... make it visitor pass." VMS shares a Supabase
// project with a sibling app that is *actually named* GatePass, and VMS's own
// schema still has a `gate_passes` table (a material-movement module whose
// pages were deleted long ago — see CLAUDE.md "No gate-pass anything in the
// admin surface"). Neither of those is a user-facing label, so this test
// targets only what a human reads on screen: literal "gate pass" text in
// .tsx files.
//
// Deliberate exceptions (rename would misdescribe something real, not a pass):
//   - "Gate Console" / "gate console" — the guard's screen name, about the
//     physical gate, not a pass.
//   - "the gate", "gate check", "at the gate" — the physical entrance.
//   - "GatePass" (no space, proper noun) in code comments referring to the
//     sibling app by name (SessionTimeout.tsx, Login.tsx) — renaming the
//     other product's name would be wrong, not right, and comments are not
//     rendered to a user anyway.
// This test only flags "gate" immediately followed by "pass" (optionally
// pluralised), case-insensitively, with at least one whitespace
// character between the two words — which is exactly the phrase the client
// asked removed, and does not touch "Gate Console", "the gate", or the
// sibling app's proper noun ("GatePass", no space, appears only in comments).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const SRC_ROOT = resolve(__dirname, '../../src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const tsxFiles = walk(SRC_ROOT);
const GATE_PASS_RE = /gate\s+pass(es)?/i;

describe('no user-facing "gate pass" wording survives in the app UI', () => {
  it('found at least one .tsx file to check (sanity check on the walker)', () => {
    expect(tsxFiles.length).toBeGreaterThan(0);
  });

  it('no .tsx file under src/ renders the literal text "gate pass" / "gate passes"', () => {
    const offenders = tsxFiles.filter((f) => GATE_PASS_RE.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.replace(SRC_ROOT, 'src'))).toEqual([]);
  });

  it('proves the pattern has teeth: it would catch a bogus "Gate Pass" label', () => {
    const bogus = 'return <span>Gate Pass Summary</span>;';
    expect(GATE_PASS_RE.test(bogus)).toBe(true);
  });

  it('does not false-positive on the deliberate exceptions', () => {
    expect(GATE_PASS_RE.test('Gate Console')).toBe(false);
    expect(GATE_PASS_RE.test('at the gate')).toBe(false);
    expect(GATE_PASS_RE.test('gate check')).toBe(false);
  });
});
