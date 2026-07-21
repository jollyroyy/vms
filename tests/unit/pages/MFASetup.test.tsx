/**
 * M23-MFA: TOTP Multi-Factor Authentication tests
 * Tests MFA flow logic (pure functions, no Supabase calls)
 */
import { describe, it, expect } from 'vitest';
import type { UserRole } from '../../../src/types/index';

// MFA requirement logic - will be in src/lib/mfa.ts
function requiresMFA(role: UserRole | null): boolean {
  if (!role) return false;
  return ['admin', 'super_admin', 'hod'].includes(role);
}

function getMFARedirectPath(role: UserRole | null): string {
  if (!role) return '/login';
  if (requiresMFA(role)) return '/mfa/verify';
  return '/';
}

function isValidTOTPCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

describe('M23-MFA: MFA requirement logic', () => {
  it('admin requires MFA', () => {
    expect(requiresMFA('admin')).toBe(true);
  });

  it('super_admin requires MFA', () => {
    expect(requiresMFA('super_admin')).toBe(true);
  });

  it('hod requires MFA', () => {
    expect(requiresMFA('hod')).toBe(true);
  });

  it('guard does NOT require MFA', () => {
    expect(requiresMFA('guard')).toBe(false);
  });

  it('staff does NOT require MFA', () => {
    expect(requiresMFA('staff')).toBe(false);
  });

  it('null role does NOT require MFA', () => {
    expect(requiresMFA(null)).toBe(false);
  });
});

describe('M23-MFA: MFA redirect paths', () => {
  it('admin redirects to /mfa/verify after password login', () => {
    expect(getMFARedirectPath('admin')).toBe('/mfa/verify');
  });

  it('hod redirects to /mfa/verify after password login', () => {
    expect(getMFARedirectPath('hod')).toBe('/mfa/verify');
  });

  it('guard redirects to / (no MFA needed)', () => {
    expect(getMFARedirectPath('guard')).toBe('/');
  });

  it('null role redirects to /login', () => {
    expect(getMFARedirectPath(null)).toBe('/login');
  });
});

describe('M23-MFA: TOTP code validation', () => {
  it('accepts valid 6-digit code', () => {
    expect(isValidTOTPCode('123456')).toBe(true);
  });

  it('rejects 5-digit code', () => {
    expect(isValidTOTPCode('12345')).toBe(false);
  });

  it('rejects 7-digit code', () => {
    expect(isValidTOTPCode('1234567')).toBe(false);
  });

  it('rejects code with letters', () => {
    expect(isValidTOTPCode('12345a')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidTOTPCode('')).toBe(false);
  });

  it('rejects code with spaces', () => {
    expect(isValidTOTPCode('123 456')).toBe(false);
  });
});

export { requiresMFA, getMFARedirectPath, isValidTOTPCode };
