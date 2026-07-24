/**
 * MFA utility functions — M23-MFA
 * TOTP Multi-Factor Authentication logic for admin/hod roles.
 */
import type { UserRole } from '../types/index';

/** Roles that are required to complete TOTP MFA before accessing the app */
const MFA_REQUIRED_ROLES: UserRole[] = ['admin', 'hod'];

/** Returns true if the given role must complete MFA */
export function requiresMFA(role: UserRole | null): boolean {
  if (!role) return false;
  return MFA_REQUIRED_ROLES.includes(role);
}

/** Returns where to redirect after successful password authentication */
export function getMFARedirectPath(role: UserRole | null): string {
  if (!role) return '/login';
  if (requiresMFA(role)) return '/mfa/verify';
  return '/';
}

/** Validates that a TOTP code is exactly 6 digits */
export function isValidTOTPCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
