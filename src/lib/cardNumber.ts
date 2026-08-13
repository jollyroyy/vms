// The visitor card number allowlist — the client half of migration 076's
// CHECK constraint. Cards print short structured codes (C-104, 27, GUEST-9);
// letters, digits and hyphens only, 1-20 characters.
//
// The DB CHECK is the real gate (any client can be bypassed); this exists to
// keep a guard from being told "check-in failed" by a constraint they cannot
// see. Keep the two in step.
export const CARD_NUMBER_PATTERN = /^[A-Za-z0-9-]{1,20}$/;

export function isValidCardNumber(value: string): boolean {
  return CARD_NUMBER_PATTERN.test(value.trim());
}