// @vitest-environment node
//
// CSP regression guard for the QR check-in path.
//
// `qr-scanner` runs its decoder inside a Worker built from a blob: URL
// (`new Worker(URL.createObjectURL(new Blob([...])))`). Worker script URLs are
// matched against `worker-src`, falling back to `child-src`, then `script-src`,
// then `default-src`. Our `script-src 'self'` does NOT match blob:, so with no
// worker-src/child-src the worker is killed the moment it loads — the constructor
// still succeeds, and the failure only arrives as a contentless error event.
// qr-scanner surfaces that as "Scanner error: [object Event]", scanImage rejects,
// and the guard sees "Could not read a QR code in that image" for a perfectly
// good pass. The live camera scanner dies the same way, silently, because it
// shares the same engine.
//
// Verified in headless Chrome 150: identical PNG decodes fine with the CSP
// removed and fails with it present. These assertions exist so the directive
// cannot be dropped again.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');

function cspDirectives(source: string): Record<string, string[]> {
  const match = source.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  if (!match) throw new Error('No CSP meta tag found in index.html');

  const out: Record<string, string[]> = {};
  for (const part of match[1]!.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) out[name] = values;
  }
  return out;
}

describe('SEC-CSP: index.html Content-Security-Policy', () => {
  const directives = cspDirectives(html);

  it('declares a CSP at all', () => {
    expect(Object.keys(directives).length).toBeGreaterThan(0);
  });

  it('allows blob: workers, or qr-scanner cannot decode anything', () => {
    expect(directives['worker-src']).toBeDefined();
    expect(directives['worker-src']).toContain('blob:');
    expect(directives['worker-src']).toContain("'self'");
  });

  it('repeats the allowance on child-src, the fallback for browsers without worker-src', () => {
    // Safari < 15.4 ignores worker-src entirely and consults child-src; without
    // this the same bug returns on iOS only, which is the worst way to find it.
    expect(directives['child-src']).toBeDefined();
    expect(directives['child-src']).toContain('blob:');
  });

  it('still refuses blob: for ordinary scripts', () => {
    // worker-src is the narrow fix. Widening script-src would have worked too,
    // and would have handed any injected script a blob: execution channel.
    expect(directives['script-src']).toEqual(["'self'"]);
  });

  it('keeps object-src locked down', () => {
    expect(directives['object-src']).toContain("'none'");
  });
});
