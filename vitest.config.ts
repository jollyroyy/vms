import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

// TDD activation mechanism (goal.md §7, /tdd-loop skill):
// tests/pending.list holds test files DERIVED from goal.md but whose feature
// slice hasn't started. The loop's Red step deletes a line from that list to
// activate the suite (red), then implements to green. Active tests must always
// pass — enforced automatically by the pre-commit hook.
function pendingFiles(): string[] {
  try {
    return readFileSync('tests/pending.list', 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'tests/security/**/*.test.ts', 'tests/security/**/*.test.tsx'],
    exclude: ['**/node_modules/**', ...pendingFiles()],
    reporters: 'default',
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
