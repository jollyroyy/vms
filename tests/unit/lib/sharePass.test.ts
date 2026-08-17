// Handing the pass to the visitor. The two mechanisms are tested apart because
// they fail apart: the share sheet is absent on Firefox and on http, and wa.me
// can never carry the file. See lib/sharePass.ts for the full reasoning.
import { describe, it, expect } from 'vitest';
import {
  waPhone, waMeUrl, passShareMessage, dataUrlToFile, canSharePassFile,
} from '../../../src/lib/sharePass';
import type { Visit } from '../../../src/types/index';

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    ref_number: 'VIS-20260817-0007',
    status: 'approved',
    purpose: 'meeting',
    created_at: '2026-08-17T04:00:00Z',
    scheduled_for: '2026-08-17T10:00:00Z',
    visitor: { full_name: 'Asha Rao', phone: '9876543210', vendor_name: 'Acme Co' },
    host: { id: 'h1', full_name: 'Ravi Kumar' },
    department: { id: 'd1', name: 'Finance' },
    ...overrides,
  } as unknown as Visit;
}

describe('waPhone — the only format wa.me accepts', () => {
  it('puts the India country code back on a bare 10-digit mobile', () => {
    expect(waPhone('9876543210')).toBe('919876543210');
  });

  // normalizePhone strips +91 and trunk zeros down to the subscriber number,
  // so every one of these has to converge on the same wa.me number.
  it.each([
    ['+91 98765 43210'],
    ['09876543210'],
    ['919876543210'],
    ['(98765) 43210'],
  ])('normalises %s to the same number', (raw) => {
    expect(waPhone(raw)).toBe('919876543210');
  });

  // A wrong recipient is worse than no recipient: it opens a stranger's chat
  // with a visitor's name and appointment already typed into it.
  it.each([[''], [null], [undefined], ['12345'], ['not a phone']])(
    'refuses %s rather than guessing a recipient', (raw) => {
      expect(waPhone(raw as string | null | undefined)).toBeNull();
    },
  );
});

describe('waMeUrl', () => {
  it('addresses the visitor and prefills the message', () => {
    const url = waMeUrl('919876543210', 'hello there');
    expect(url).toBe('https://wa.me/919876543210?text=hello%20there');
  });

  // Degrades to the contact picker, never to a dead button.
  it('opens WhatsApp with no recipient when the number is unusable', () => {
    expect(waMeUrl(null, 'hi')).toBe('https://wa.me/?text=hi');
  });

  it('encodes newlines so the whole message survives the URL', () => {
    const url = waMeUrl('919876543210', passShareMessage(visit()));
    expect(url).not.toMatch(/\n/);
    expect(decodeURIComponent(url.split('?text=')[1])).toContain('VIS-20260817-0007');
  });
});

describe('passShareMessage', () => {
  it('carries the reference, the host and the time', () => {
    const text = passShareMessage(visit());
    expect(text).toContain('VIS-20260817-0007');
    expect(text).toContain('Ravi Kumar');
    expect(text).toContain('Finance');
    expect(text).toContain('photo ID');
  });

  // A walk-in has no slot. The line is dropped rather than printing an empty
  // "When:", which reads as a time somebody failed to fill in.
  it('omits the time for a visit with no scheduled slot', () => {
    expect(passShareMessage(visit({ scheduled_for: null }))).not.toContain('When:');
  });
});

describe('dataUrlToFile — synchronous on purpose', () => {
  // 1x1 transparent PNG.
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  it('decodes a base64 data URL into a PNG File', () => {
    const file = dataUrlToFile(PNG, 'pass.png');
    expect(file).toBeInstanceOf(File);
    expect(file?.type).toBe('image/png');
    expect(file?.name).toBe('pass.png');
    expect(file!.size).toBeGreaterThan(0);
  });

  // It must not be async. `fetch(dataUrl)` is the tidier spelling and is
  // exactly what spends the user gesture navigator.share needs, so this test
  // pins the signature rather than just the output.
  it('returns the File directly, not a promise', () => {
    expect(dataUrlToFile(PNG, 'pass.png')).not.toBeInstanceOf(Promise);
  });

  it.each([['not-a-data-url'], ['data:image/png,rawtext'], ['data:image/png;base64,!!!!']])(
    'returns null for %s rather than an empty file', (bad) => {
      expect(dataUrlToFile(bad, 'pass.png')).toBeNull();
    },
  );
});

describe('canSharePassFile — the gate, not an exception', () => {
  const file = dataUrlToFile(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'pass.png',
  );

  // jsdom ships no Web Share API, which is the Firefox/desktop case: the caller
  // must fall through to wa.me rather than throwing at the gate.
  it('is false where the browser has no share sheet', () => {
    expect(canSharePassFile(file)).toBe(false);
  });

  it('is false with no file to share', () => {
    expect(canSharePassFile(null)).toBe(false);
  });
});
