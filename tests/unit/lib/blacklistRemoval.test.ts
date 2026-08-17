// The admin/CEO half of taking a visitor off the blacklist.
//
// NEITHER FUNCTION UNDER TEST WRITES `visitors` — both go through a
// SECURITY DEFINER RPC (migration 091/092). These tests pin the shape of
// those two calls and the client-side gates that stand in front of them:
// the gate must refuse BEFORE the network call, not just disable a button,
// because the button is a convenience and the DB trigger is the actual
// boundary.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.hoisted(() => vi.fn(async () => ({ data: 'req-1', error: null })));
vi.mock('../../../src/supabaseClient', () => ({
  supabase: { rpc },
}));

import {
  removalJustificationError, normalizeRemovalText,
  requestBlacklistRemoval, decideBlacklistRemoval,
  REMOVAL_JUSTIFICATION_MIN, REMOVAL_JUSTIFICATION_MAX,
} from '../../../src/lib/blacklistRemoval';

beforeEach(() => {
  rpc.mockClear();
  rpc.mockResolvedValue({ data: 'req-1', error: null });
});

describe('removalJustificationError', () => {
  it('accepts a real sentence', () => {
    expect(removalJustificationError('Visitor cleared by security after review.')).toBeNull();
  });

  it('refuses an empty justification', () => {
    expect(removalJustificationError('')).toMatch(/required/i);
  });

  it('refuses a whitespace-only justification the same as empty — squashSpace trims it to nothing', () => {
    expect(removalJustificationError('    ')).toMatch(/required/i);
  });

  it('refuses text below the 10-character floor, naming the floor', () => {
    // "ok, fine" style rubber-stamps are exactly what a bare non-empty rule
    // would let through; the floor is the whole point of this function.
    expect(removalJustificationError('too short')).toMatch(new RegExp(String(REMOVAL_JUSTIFICATION_MIN)));
  });

  it('accepts exactly the 10-character floor', () => {
    const exactlyTen = 'a'.repeat(REMOVAL_JUSTIFICATION_MIN);
    expect(exactlyTen.length).toBe(10);
    expect(removalJustificationError(exactlyTen)).toBeNull();
  });
});

describe('normalizeRemovalText', () => {
  it('strips control characters', () => {
    // Built from codepoints rather than typed as a literal, for the same
    // reason `stripControlChars` filters by codepoint: a literal would put
    // real control bytes into this source file — which is what the first
    // draft of this test did.
    const withControls = `hello${String.fromCodePoint(0x07)}world${String.fromCodePoint(0x7f)}`;
    expect(normalizeRemovalText(withControls, 500)).toBe('helloworld');
  });

  it('truncates at REMOVAL_JUSTIFICATION_MAX, which mirrors the DB CHECK', () => {
    expect(normalizeRemovalText('a'.repeat(600), REMOVAL_JUSTIFICATION_MAX))
      .toHaveLength(REMOVAL_JUSTIFICATION_MAX);
  });

  it('squashes runs of internal whitespace and trims the ends', () => {
    expect(normalizeRemovalText('  hello    world  ', 500)).toBe('hello world');
  });

  it('truncates at the given max', () => {
    expect(normalizeRemovalText('a'.repeat(20), 5)).toBe('aaaaa');
  });
});

describe('requestBlacklistRemoval', () => {
  it('throws before ever calling supabase when the justification is too short', async () => {
    // The gate is not only the disabled button — a caller that bypasses the
    // form must still be refused before a network round trip is spent.
    await expect(requestBlacklistRemoval('v1', 'short')).rejects.toThrow(/at least/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sends the normalized text and the visitor id when the justification is valid', async () => {
    await requestBlacklistRemoval('v1', '  Cleared   after   an  internal review.  ');
    expect(rpc).toHaveBeenCalledWith('request_blacklist_removal', {
      p_visitor_id: 'v1',
      p_justification: 'Cleared after an internal review.',
    });
  });

  it('rethrows the database error message verbatim', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'That visitor is not blacklisted' } });
    await expect(requestBlacklistRemoval('v1', 'A perfectly valid justification sentence.'))
      .rejects.toThrow('That visitor is not blacklisted');
  });
});

describe('decideBlacklistRemoval', () => {
  it('refusing with an empty note throws and never calls the rpc', async () => {
    await expect(decideBlacklistRemoval('req-1', false, '')).rejects.toThrow(/reason is required/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refusing with a note calls the rpc with p_approve false and the note', async () => {
    await decideBlacklistRemoval('req-1', false, 'No corroborating evidence was provided.');
    expect(rpc).toHaveBeenCalledWith('decide_blacklist_removal', {
      p_request_id: 'req-1',
      p_approve: false,
      p_note: 'No corroborating evidence was provided.',
    });
  });

  // The asymmetry documented in blacklistRemoval.ts: approving grants exactly
  // what was asked for and the admin's justification is already on the row,
  // so a second sentence would only restate it — approval needs no note.
  it('approving with no note is allowed and sends p_note null', async () => {
    await decideBlacklistRemoval('req-1', true, '');
    expect(rpc).toHaveBeenCalledWith('decide_blacklist_removal', {
      p_request_id: 'req-1',
      p_approve: true,
      p_note: null,
    });
  });

  it('rethrows the database error message verbatim', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Only the CEO can decide this' } });
    await expect(decideBlacklistRemoval('req-1', true, '')).rejects.toThrow('Only the CEO can decide this');
  });
});
