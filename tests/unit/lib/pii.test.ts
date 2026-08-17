import { describe, it, expect } from 'vitest';
import { maskIdProof, maskPhone, maskName, maskIdProofForExport, maskPhoneForExport } from '../../../src/lib/pii';

describe('pii', () => {
  describe('maskIdProof', () => {
    it('renders id type with last 2 digits masked: Aadhaar 9646 → Aadhaar ••••46', () => {
      const result = maskIdProof('Aadhaar', '9646');
      expect(result).toBe('Aadhaar ••••46');
    });

    it('renders id type with last 2 digits when input has more than 4 digits', () => {
      const result = maskIdProof('Passport', '123456');
      expect(result).toBe('Passport ••••56');
    });

    it('masks the full id number and does not expose all digits', () => {
      const result = maskIdProof('Aadhaar', '9646');
      expect(result).not.toContain('9646');
    });

    it('returns em-dash when idLast4 is null', () => {
      const result = maskIdProof('Aadhaar', null);
      expect(result).toBe('—');
    });

    it('returns em-dash when idLast4 is undefined', () => {
      const result = maskIdProof('Aadhaar', undefined);
      expect(result).toBe('—');
    });

    it('returns em-dash when idLast4 is empty string', () => {
      const result = maskIdProof('Aadhaar', '');
      expect(result).toBe('—');
    });

    it('returns em-dash when idLast4 contains only punctuation', () => {
      const result = maskIdProof('Aadhaar', '--');
      expect(result).toBe('—');
    });

    it('returns em-dash when idLast4 is punctuation with spaces', () => {
      const result = maskIdProof('Aadhaar', '- - - -');
      expect(result).toBe('—');
    });

    it('falls back to ID when idType is null', () => {
      const result = maskIdProof(null, '9646');
      expect(result).toBe('ID ••••46');
    });

    it('falls back to ID when idType is undefined', () => {
      const result = maskIdProof(undefined, '9646');
      expect(result).toBe('ID ••••46');
    });

    it('falls back to ID when idType is empty string', () => {
      const result = maskIdProof('', '9646');
      expect(result).toBe('ID ••••46');
    });

    it('renders when idLast4 is shorter than 2 chars without throwing', () => {
      const result = maskIdProof('Passport', '7');
      expect(result).toBe('Passport ••••7');
    });

    it('renders when idLast4 is single digit with padding', () => {
      const result = maskIdProof('License', '4');
      expect(result).toBe('License ••••4');
    });

    it('strips punctuation from idLast4 before processing', () => {
      const result = maskIdProof('Aadhaar', '96-46');
      expect(result).toBe('Aadhaar ••••46');
    });

    it('strips mixed punctuation and whitespace from idLast4', () => {
      const result = maskIdProof('DL', '12 - 34');
      expect(result).toBe('DL ••••34');
    });

    it('handles both null id type and null id last4', () => {
      const result = maskIdProof(null, null);
      expect(result).toBe('—');
    });

    it('preserves alphanumeric characters in idLast4', () => {
      const result = maskIdProof('PAN', 'A9B6');
      expect(result).toBe('PAN ••••B6');
    });
  });

  describe('maskPhone', () => {
    it('masks all digits but last 4 of a long phone number', () => {
      const result = maskPhone('9876543210');
      expect(result).toBe('••••••3210');
    });

    it('masks all digits except last 4', () => {
      const result = maskPhone('1234567890');
      expect(result).toBe('••••••7890');
    });

    it('returns em-dash when phone is null', () => {
      const result = maskPhone(null);
      expect(result).toBe('—');
    });

    it('returns em-dash when phone is undefined', () => {
      const result = maskPhone(undefined);
      expect(result).toBe('—');
    });

    it('returns em-dash when phone is empty string', () => {
      const result = maskPhone('');
      expect(result).toBe('—');
    });

    it('returns all bullets when phone length is 1', () => {
      const result = maskPhone('9');
      expect(result).toBe('••••');
    });

    it('returns all bullets when phone length is 2', () => {
      const result = maskPhone('98');
      expect(result).toBe('••••');
    });

    it('returns all bullets when phone length is 3', () => {
      const result = maskPhone('987');
      expect(result).toBe('••••');
    });

    it('shows last 4 chars when exactly 4 chars long', () => {
      const result = maskPhone('1234');
      expect(result).toBe('1234');
    });

    it('masks digit before last 4 and shows last 4 for 5-char phone', () => {
      const result = maskPhone('12345');
      expect(result).toBe('•2345');
    });

    it('masks digits but preserves non-digit characters', () => {
      const result = maskPhone('+1 (987) 654-3210');
      expect(result).toContain('3210');
      expect(result).toContain('+');
    });

    it('does not expose more than last 4 digits', () => {
      const result = maskPhone('9876543210');
      expect(result).not.toContain('9876');
    });
  });

  describe('maskName', () => {
    it('masks single-word name: John → J•••', () => {
      const result = maskName('John');
      expect(result).toBe('J•••');
    });

    it('masks single-word name: Alice → A•••', () => {
      const result = maskName('Alice');
      expect(result).toBe('A•••');
    });

    it('masks two-word name with first letters visible', () => {
      const result = maskName('John Doe');
      expect(result).toBe('J••• D•••');
    });

    it('masks three-word name with first letters visible', () => {
      const result = maskName('John Paul Smith');
      expect(result).toBe('J••• P••• S•••');
    });

    it('returns em-dash when name is null', () => {
      const result = maskName(null);
      expect(result).toBe('—');
    });

    it('returns em-dash when name is undefined', () => {
      const result = maskName(undefined);
      expect(result).toBe('—');
    });

    it('returns em-dash when name is empty string', () => {
      const result = maskName('');
      expect(result).toBe('—');
    });

    it('trims whitespace from single word names', () => {
      const result = maskName('  Alice  ');
      expect(result).toBe('A•••');
    });

    it('trims and masks multi-word names with extra spaces', () => {
      const result = maskName('  Jane   Doe  ');
      expect(result).toBe('J••• D•••');
    });

    it('handles names with multiple consecutive spaces', () => {
      const result = maskName('John    Paul    Smith');
      expect(result).toBe('J••• P••• S•••');
    });

    it('shows only first character of each name part', () => {
      const result = maskName('Christopher Alexander Johnson');
      expect(result).toBe('C••• A••• J•••');
    });

    it('handles single-letter first names', () => {
      const result = maskName('A Smith');
      expect(result).toBe('A••• S•••');
    });
  });

  // THE EXPORT VARIANTS EXIST BECAUSE A CSV IS NOT A SCREEN. Excel guesses a
  // file's encoding from the locale, so the bullet the screen renders came back
  // as "a<euro>oea<euro>oe..." in the downloaded register (client report,
  // 2026-08-17). Same redaction rule, ASCII fill.
  describe('export variants', () => {
    it('masks a phone with X and keeps the same last four the screen keeps', () => {
      expect(maskPhoneForExport('9876543210')).toBe('XXXXXX3210');
      expect(maskPhoneForExport('9876543210')).toHaveLength(maskPhone('9876543210').length);
    });

    it('masks an ID proof with X and keeps the same last two', () => {
      expect(maskIdProofForExport('Aadhaar', '9646')).toBe('Aadhaar XXXX46');
    });

    it('hides everything the screen hides', () => {
      expect(maskPhoneForExport('9876543210')).not.toContain('9876');
      expect(maskIdProofForExport('Aadhaar', '9646')).not.toContain('9646');
    });

    it('says Not recorded rather than a dash when there is nothing on record', () => {
      expect(maskPhoneForExport(null)).toBe('Not recorded');
      expect(maskPhoneForExport('')).toBe('Not recorded');
      expect(maskIdProofForExport('Aadhaar', null)).toBe('Not recorded');
      expect(maskIdProofForExport(null, '')).toBe('Not recorded');
    });

    it('falls back to ID for an unknown type, as the screen does', () => {
      expect(maskIdProofForExport(null, '9646')).toBe('ID XXXX46');
    });

    it('emits pure ASCII for every input shape', () => {
      const outputs = [
        maskPhoneForExport('9876543210'), maskPhoneForExport('98'), maskPhoneForExport('+1 (987) 654-3210'),
        maskPhoneForExport(null), maskIdProofForExport('Aadhaar', '9646'),
        maskIdProofForExport('Passport', '7'), maskIdProofForExport(undefined, undefined),
      ];
      for (const out of outputs) expect(out).toMatch(/^[ -~]*$/);
    });

    it('leaves the on-screen masks alone', () => {
      expect(maskPhone('9876543210')).toContain('•');
      expect(maskIdProof('Aadhaar', '9646')).toContain('•');
    });
  });
});
