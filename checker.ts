/**
 * checker.ts — VMS automated test runner
 *
 * Runs every check in sequence. First failure stops everything and prints
 * exactly what broke. If everything passes, prints "ALL TESTS PASSED".
 *
 * Run:   npx tsx checker.ts
 * Hook:  called automatically by .githooks/pre-commit on every commit
 * Loop:  the loop calls this at the end of every iteration (step 4, goal.md §3)
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

// ─── colour helpers ──────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;  // green
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;  // red
const B = (s: string) => `\x1b[1m${s}\x1b[0m`;   // bold
const D = (s: string) => `\x1b[2m${s}\x1b[0m`;   // dim

// ─── helpers ─────────────────────────────────────────────────────────────────
function run(label: string, cmd: string, args: string[]): void {
  console.log(`\n${B(`▶ ${label}`)}`);
  console.log(D(`  $ ${cmd} ${args.join(' ')}`));

  // On Windows npx/tsc are .cmd files; pass as a single joined string so
  // shell:true is safe (args are controlled constants, not user input).
  const fullCmd = [cmd, ...args].join(' ');
  const result = spawnSync(fullCmd, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' },
  } as Parameters<typeof spawnSync>[1]);

  if (result.status !== 0) {
    console.log(`\n${R(B('✖ FAILED:'))} ${R(label)}`);
    console.log(R('─'.repeat(60)));
    console.log(R('Stopped. Fix the failure above then re-run checker.ts.'));
    process.exit(result.status ?? 1);
  }

  console.log(G(`  ✔ ${label} passed`));
}

function pendingCount(): number {
  const file = 'tests/pending.list';
  if (!existsSync(file)) return 0;
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .length;
}

// ─── main ────────────────────────────────────────────────────────────────────
console.log(B('\n╔══════════════════════════════════════╗'));
console.log(B(  '║   VMS Checker — automated test gate  ║'));
console.log(B(  '╚══════════════════════════════════════╝'));

const pending = pendingCount();
if (pending > 0) {
  console.log(D(`\n  ${pending} suite(s) still in tests/pending.list (not yet activated)`));
}

// Step 1 — TypeScript: no type errors allowed
run(
  'Step 1 of 3 — TypeScript (tsc --noEmit)',
  'npx', ['tsc', '--noEmit'],
);

// Step 2 — Unit tests: pure logic, no network, must pass in milliseconds
run(
  'Step 2 of 3 — Unit tests (vitest run tests/unit)',
  'npx', ['vitest', 'run', 'tests/unit'],
);

// Step 3 — Security tests: RLS denial cases, photo-privacy 403s
run(
  'Step 3 of 3 — Security tests (vitest run tests/security)',
  'npx', ['vitest', 'run', 'tests/security'],
);

// ─── All passed ──────────────────────────────────────────────────────────────
console.log(`\n${G(B('═'.repeat(60)))}`);
console.log(G(B('  ✔  ALL TESTS PASSED')));
if (pending > 0) {
  console.log(G(`     (${pending} suite(s) queued in tests/pending.list — not yet activated)`));
}
console.log(`${G(B('═'.repeat(60)))}\n`);
