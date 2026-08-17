import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToCsv } from '../../../src/lib/exportUtils';

// The CSV writer's whole contract: the header row, quoting, and — since
// 2026-08-17 — a UTF-8 BOM. Excel guesses a CSV's encoding from the locale's
// ANSI code page unless the file announces itself, which is how an em dash
// reached the client as "a<euro>". The BOM is the one signal Excel,
// LibreOffice and Numbers all honour.

const blobs: Blob[] = [];

beforeEach(() => {
  blobs.length = 0;
  // Assigned, not spied: jsdom implements neither, so there is nothing to spy on.
  URL.createObjectURL = (b: Blob | MediaSource) => {
    blobs.push(b as Blob);
    return 'blob:test';
  };
  URL.revokeObjectURL = () => {};
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

// The BYTES, not blob.text() — that decodes as UTF-8 and the spec has it strip
// a leading BOM, which is precisely the byte under test.
async function csvBytes(rows: Record<string, unknown>[]): Promise<Uint8Array> {
  exportToCsv(rows, 'test.csv');
  return blobs[0] ? new Uint8Array(await blobs[0].arrayBuffer()) : new Uint8Array();
}

async function csvText(rows: Record<string, unknown>[]): Promise<string> {
  exportToCsv(rows, 'test.csv');
  return blobs[0] ? await blobs[0].text() : '';
}

describe('exportToCsv', () => {
  it('starts the file with a UTF-8 BOM', async () => {
    const bytes = await csvBytes([{ Name: 'Asha' }]);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('writes the header row and one row per record, immediately after the BOM', async () => {
    const text = await csvText([{ Name: 'Asha', Phone: 'XXXXXX3210' }, { Name: 'Ravi', Phone: 'Not recorded' }]);
    expect(text.split('\n')).toEqual([
      'Name,Phone',
      '"Asha","XXXXXX3210"',
      '"Ravi","Not recorded"',
    ]);
  });

  it('escapes embedded quotes rather than breaking the row', async () => {
    const text = await csvText([{ Note: 'he said "no"' }]);
    expect(text).toContain('"he said ""no"""');
  });

  it('writes nothing at all for an empty set', async () => {
    exportToCsv([], 'test.csv');
    expect(blobs).toHaveLength(0);
  });
});
