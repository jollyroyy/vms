#!/usr/bin/env node
// Cross-platform Python launcher for verify.py.
// Tries python → py → python3 in order. Works on Windows (git bash, cmd, powershell) and Unix.
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const candidates = process.platform === 'win32'
  ? ['python', 'py', 'python3']
  : ['python3', 'python'];

for (const cmd of candidates) {
  const result = spawnSync(cmd, ['verify.py', ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== null && result.status !== undefined) {
    process.exit(result.status);
  }
}

process.stderr.write(
  'ERROR: Python not found. Install Python 3.8+ and ensure it is on your PATH.\n'
);
process.exit(1);
