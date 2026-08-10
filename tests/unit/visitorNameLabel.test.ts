// The visitor's name label used to read "Full Name" on some screens and
// "Name" on others (forms, table headers, search hints, the ID-scan review
// panel). 2026-08-10: every user-facing spelling was unified to
// "Visitor Name". This spec is the backstop — it greps every .tsx file under
// src/ for a literal "Full Name" label and fails if one reappears, so a
// future form pasted from an old pattern cannot quietly regress the wording.
//
// It intentionally does NOT ban `full_name` (the DB column / identifier,
// lowercase-with-underscore) — only the human-readable "Full Name" spelling.
// Nothing in this app currently labels a DIFFERENT person's name field
// "Full Name" either (the self-service profile page — the one place that
// edits a STAFF member's own name — calls it "Display name"), so there is no
// allowlist entry to carve out. If one is ever added for a genuinely
// different person, exclude that exact file by path here, not by loosening
// the pattern.
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

describe('no user-facing "Full Name" label survives for the visitor field', () => {
  it('found at least one .tsx file to check (sanity check on the walker)', () => {
    expect(tsxFiles.length).toBeGreaterThan(0);
  });

  it('no .tsx file under src/ renders the literal text "Full Name"', () => {
    const offenders = tsxFiles.filter((f) => readFileSync(f, 'utf8').includes('Full Name'));
    expect(offenders.map((f) => f.replace(SRC_ROOT, 'src'))).toEqual([]);
  });
});
