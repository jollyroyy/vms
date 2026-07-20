/**
 * checker.ts — VMS automated test gate
 *
 * Runs every check in sequence. NEVER stops early — every step always runs
 * and every result is reported. At the end:
 *   • All passed  → "ALL TESTS PASSED"
 *   • Any failed  → lists exactly which steps were NOT PASSED, exits non-zero
 *                   (pre-commit hook blocks the commit)
 *
 * The loop calls this at Step 3 (before coding) and Step 5 (after each fix).
 * The git pre-commit hook calls it automatically on every commit.
 *
 * Usage:  npm run verify
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

// ─── colour helpers ──────────────────────────────────────────────────────────
const GREEN  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const RED    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;
const BOLD   = (s: string) => `\x1b[1m${s}\x1b[0m`;
const DIM    = (s: string) => `\x1b[2m${s}\x1b[0m`;
const LINE   = '─'.repeat(56);

// ─── check definition ────────────────────────────────────────────────────────
interface Check {
  label: string;          // short name shown in the summary table
  description: string;    // what this check verifies (from goal.md)
  cmd: string;
  args: string[];
}

const CHECKS: Check[] = [
  {
    label: 'TypeScript',
    description: 'No type errors anywhere in src/ (goal.md §2.1)',
    cmd: 'npx', args: ['tsc', '--noEmit'],
  },
  {
    label: 'Unit tests',
    description: 'Pure logic: ref numbers, status machines, due dates, blacklist, photo math (goal.md §7)',
    cmd: 'npx', args: ['vitest', 'run', 'tests/unit'],
  },
  {
    label: 'Security tests',
    description: 'RLS denial cases, photo-privacy 403s, server-auth data (goal.md SEC-1/2/3/5)',
    cmd: 'npx', args: ['vitest', 'run', 'tests/security'],
  },
];

// ─── helpers ─────────────────────────────────────────────────────────────────
function pendingCount(): number {
  try {
    return readFileSync('tests/pending.list', 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.startsWith('#'))
      .length;
  } catch { return 0; }
}

function goalCriteriaMet(): { total: number; done: number } {
  if (!existsSync('goal.md')) return { total: 0, done: 0 };
  const lines = readFileSync('goal.md', 'utf8').split(/\r?\n/);
  const criteria = lines.filter((l) => /- \[[ x]\] 🎯/.test(l));
  const done     = criteria.filter((l) => /- \[x\]/.test(l));
  return { total: criteria.length, done: done.length };
}

function runCheck(check: Check): 'PASSED' | 'NOT PASSED' {
  const full = [check.cmd, ...check.args].join(' ');
  const result = spawnSync(full, { stdio: 'inherit', shell: true,
    env: { ...process.env, FORCE_COLOR: '1' } });
  return result.status === 0 ? 'PASSED' : 'NOT PASSED';
}

// ─── main ────────────────────────────────────────────────────────────────────
const pending = pendingCount();
const { total: goalTotal, done: goalDone } = goalCriteriaMet();

console.log(BOLD('\n╔══════════════════════════════════════════════════════╗'));
console.log(BOLD(  '║          VMS Checker — goal-driven test gate         ║'));
console.log(BOLD(  '╚══════════════════════════════════════════════════════╝'));
console.log(DIM(`\n  Goal progress : ${goalDone} / ${goalTotal} Milestone A criteria met`));
console.log(DIM(`  Pending suites: ${pending} queued in tests/pending.list (not yet activated)\n`));
console.log(DIM('  Loop question before each run:'));
console.log(DIM('  "Which goal is not yet met, and what would prove it is?"\n'));

// Run every check — never stop early
const results: Array<{ check: Check; status: 'PASSED' | 'NOT PASSED' }> = [];

for (let i = 0; i < CHECKS.length; i++) {
  const check = CHECKS[i]!;
  console.log(BOLD(`\n${LINE}`));
  console.log(BOLD(`  Check ${i + 1} of ${CHECKS.length} — ${check.label}`));
  console.log(DIM(`  ${check.description}`));
  console.log(DIM(`  $ ${check.cmd} ${check.args.join(' ')}`));
  console.log(BOLD(`${LINE}\n`));

  const status = runCheck(check);
  results.push({ check, status });

  if (status === 'PASSED') {
    console.log(GREEN(`\n  ✔  ${check.label}: PASSED`));
  } else {
    console.log(RED(`\n  ✖  ${check.label}: NOT PASSED`));
    console.log(YELLOW(`     → Fix the failure above, then run npm run verify again.`));
    console.log(YELLOW(`     → Do not move to the next goal criterion until this passes.`));
  }
}

// ─── summary ─────────────────────────────────────────────────────────────────
const failed  = results.filter((r) => r.status === 'NOT PASSED');
const passed  = results.filter((r) => r.status === 'PASSED');

console.log(BOLD(`\n${'═'.repeat(56)}`));
console.log(BOLD('  SUMMARY'));
console.log(BOLD('═'.repeat(56)));

for (const { check, status } of results) {
  const icon  = status === 'PASSED' ? GREEN('✔') : RED('✖');
  const label = status === 'PASSED' ? GREEN(check.label) : RED(check.label);
  const tag   = status === 'PASSED' ? GREEN('PASSED') : RED('NOT PASSED');
  console.log(`  ${icon}  ${label.padEnd(30)} ${tag}`);
}

console.log(BOLD('═'.repeat(56)));

if (failed.length === 0) {
  console.log(GREEN(BOLD('\n  ✔  ALL TESTS PASSED')));
  if (pending > 0) {
    console.log(GREEN(DIM(`     (${pending} suite(s) still queued — activate the next one for the next goal)`)));
  }
  console.log(GREEN(BOLD(`     Goal: ${goalDone} / ${goalTotal} Milestone A criteria checked off\n`)));
  process.exit(0);
} else {
  console.log(RED(BOLD(`\n  ✖  ${failed.length} CHECK(S) NOT PASSED:`)));
  for (const { check } of failed) {
    console.log(RED(`     • ${check.label}`));
    console.log(RED(DIM(`       ${check.description}`)));
  }
  console.log('');
  console.log(YELLOW(BOLD('  Loop action (goal.md §3 Step 5):')));
  console.log(YELLOW('  Fix the failing check(s) above and run npm run verify again.'));
  console.log(YELLOW('  Do not move to the next goal criterion with a failing check.'));
  console.log(YELLOW('  After 3 failed attempts → decompose or flag as Blocked (needs human).'));
  console.log('');
  process.exit(1);
}
