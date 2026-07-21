import { describe, it, expect, beforeEach } from 'vitest';
import { getRateLimit, recordFailedAttempt, recordPageLoad, resetRateLimit } from '../../src/lib/rateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it('allows login when no attempts recorded', () => {
    const rl = getRateLimit();
    expect(rl.blocked).toBe(false);
    expect(rl.message).toBe('');
  });

  it('blocks after 5 failed attempts', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt();
    const rl = getRateLimit();
    expect(rl.blocked).toBe(true);
    expect(rl.message).toContain('Too many login attempts');
  });

  it('allows login after 4 failed attempts', () => {
    for (let i = 0; i < 4; i++) recordFailedAttempt();
    const rl = getRateLimit();
    expect(rl.blocked).toBe(false);
  });

  it('increases lockout duration on additional attempts', () => {
    for (let i = 0; i < 6; i++) recordFailedAttempt();
    const rl1 = getRateLimit();
    expect(rl1.remainingSeconds).toBeGreaterThanOrEqual(60);

    for (let i = 0; i < 3; i++) recordFailedAttempt();
    const rl2 = getRateLimit();
    expect(rl2.remainingSeconds).toBeGreaterThanOrEqual(rl1.remainingSeconds);
  });

  it('blocks after 20 page loads within window', () => {
    for (let i = 0; i < 20; i++) recordPageLoad();
    const rl = getRateLimit();
    expect(rl.blocked).toBe(true);
  });

  it('returns remaining seconds as number', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt();
    const rl = getRateLimit();
    expect(typeof rl.remainingSeconds).toBe('number');
    expect(rl.remainingSeconds).toBeGreaterThan(0);
  });

  it('resets after calling resetRateLimit', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt();
    expect(getRateLimit().blocked).toBe(true);
    resetRateLimit();
    expect(getRateLimit().blocked).toBe(false);
  });
});
