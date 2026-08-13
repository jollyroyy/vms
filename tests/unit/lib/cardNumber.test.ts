import { describe, it, expect } from 'vitest';
import { isValidCardNumber } from '../../../src/lib/cardNumber';

// The client half of migration 076's CHECK constraint (visits_card_number_format
// is `^[A-Za-z0-9-]{1,20}$` in the database). Keep the two in step.

describe('cardNumber — isValidCardNumber', () => {
  it('accepts a plain card number', () => {
    expect(isValidCardNumber('C-104')).toBe(true);
  });

  it('accepts letters, digits and hyphens in any mix', () => {
    expect(isValidCardNumber('V2-9C-D04')).toBe(true);
    expect(isValidCardNumber('104')).toBe(true);
    expect(isValidCardNumber('V')).toBe(true);
  });

  it('accepts exactly 20 characters', () => {
    expect(isValidCardNumber('A'.repeat(20))).toBe(true);
  });

  it('rejects an empty string and whitespace-only input', () => {
    expect(isValidCardNumber('')).toBe(false);
    expect(isValidCardNumber('   ')).toBe(false);
  });

  it('rejects anything beyond letters, digits and hyphens', () => {
    expect(isValidCardNumber('C 104')).toBe(false);
    expect(isValidCardNumber('C_104')).toBe(false);
    expect(isValidCardNumber('C.104')).toBe(false);
    expect(isValidCardNumber('C/104')).toBe(false);
    expect(isValidCardNumber('C-10₹')).toBe(false);
  });

  it('rejects more than 20 characters', () => {
    expect(isValidCardNumber('A'.repeat(21))).toBe(false);
  });
});