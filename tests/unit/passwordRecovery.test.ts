import { describe, it, expect, beforeEach } from 'vitest';
import {
  markRecoveryPending,
  clearRecoveryPending,
  isRecoveryPending,
  hasRecoveryHash,
} from '../../src/lib/passwordRecovery';

/**
 * SEC: a Supabase recovery link creates a normal, PERSISTED session. Gating only on the
 * one-time `type=recovery` URL hash meant abandoning the reset form left that session
 * usable — the next load had no hash, so the user reached the dashboard without ever
 * setting a password. These tests lock in the durable flag that closes that.
 */
describe('password recovery gate', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reports not pending by default', () => {
    expect(isRecoveryPending()).toBe(false);
  });

  it('reports pending once marked', () => {
    markRecoveryPending();
    expect(isRecoveryPending()).toBe(true);
  });

  it('SURVIVES a page reload — the flag outlives the one-time recovery hash', () => {
    markRecoveryPending();
    // Simulate a fresh load: the hash is gone, but the session would still be valid.
    expect(hasRecoveryHash()).toBe(false);
    expect(isRecoveryPending()).toBe(true);
  });

  it('clears once the reset completes', () => {
    markRecoveryPending();
    clearRecoveryPending();
    expect(isRecoveryPending()).toBe(false);
  });

  it('is idempotent when cleared twice', () => {
    markRecoveryPending();
    clearRecoveryPending();
    clearRecoveryPending();
    expect(isRecoveryPending()).toBe(false);
  });

  it('treats an unrelated stored value as not pending', () => {
    window.localStorage.setItem('sg-password-recovery-pending', 'nope');
    expect(isRecoveryPending()).toBe(false);
  });
});
