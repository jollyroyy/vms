import { describe, it, expect } from 'vitest';
import { parseIdDocument, type IdDocumentType, type ParsedId } from '../../../../src/lib/ai/idParser';

describe('M-AI-PARSER: parseIdDocument', () => {
  describe('empty and edge cases', () => {
    it('returns unknown for empty input', () => {
      expect(parseIdDocument('')).toEqual({
        type: 'unknown', rawNumber: null, name: null, dateOfBirth: null,
      });
    });

    it('returns unknown for whitespace-only input', () => {
      expect(parseIdDocument('   \n\t  ')).toEqual({
        type: 'unknown', rawNumber: null, name: null, dateOfBirth: null,
      });
    });

    it('returns unknown when no ID-shaped number is present', () => {
      const result = parseIdDocument('VISITOR NAME: John Doe\nCompany: Acme Corp');
      expect(result.type).toBe('unknown');
      expect(result.rawNumber).toBeNull();
    });
  });

  describe('PAN detection', () => {
    it('detects a PAN number', () => {
      const result = parseIdDocument('ABCDE1234F');
      expect(result.type).toBe('pan');
      expect(result.rawNumber).toBe('ABCDE1234F');
    });

    it('detects PAN embedded in surrounding text', () => {
      const text = 'PERMANENT ACCOUNT NUMBER\nABCDE1234F\nNAME: Jane Smith';
      const result = parseIdDocument(text);
      expect(result.type).toBe('pan');
      expect(result.rawNumber).toBe('ABCDE1234F');
    });
  });

  describe('Aadhaar detection', () => {
    it('detects a 12-digit Aadhaar as three groups of 4', () => {
      const result = parseIdDocument('2345 6789 0123');
      expect(result.type).toBe('aadhaar');
      expect(result.rawNumber).toBe('2345 6789 0123');
    });

    it('detects a 12-digit Aadhaar without spaces', () => {
      const result = parseIdDocument('234567890123');
      expect(result.type).toBe('aadhaar');
      expect(result.rawNumber).toBe('234567890123');
    });

    it('rejects a 12-digit number starting with 0', () => {
      const result = parseIdDocument('0234 5678 9012');
      expect(result.type).toBe('unknown');
      expect(result.rawNumber).toBeNull();
    });

    it('rejects a 12-digit number starting with 1', () => {
      const result = parseIdDocument('1234 5678 9012');
      expect(result.type).toBe('unknown');
      expect(result.rawNumber).toBeNull();
    });
  });

  describe('Passport detection', () => {
    it('detects an Indian passport number (letter + 7 digits)', () => {
      const result = parseIdDocument('A1234567');
      expect(result.type).toBe('passport');
      expect(result.rawNumber).toBe('A1234567');
    });

    it('detects passport embedded in text', () => {
      const text = 'PASSPORT\nA1234567\nNAME: John';
      const result = parseIdDocument(text);
      expect(result.type).toBe('passport');
      expect(result.rawNumber).toBe('A1234567');
    });
  });

  describe('Driving licence detection', () => {
    it('detects an Indian driving licence number', () => {
      const result = parseIdDocument('MH12 20110012345');
      expect(result.type).toBe('driving_licence');
      expect(result.rawNumber).toBe('MH12 20110012345');
    });

    it('detects DL with a dash separator', () => {
      const result = parseIdDocument('DL-0420110149646');
      expect(result.type).toBe('driving_licence');
      expect(result.rawNumber).toBe('DL-0420110149646');
    });
  });

  // PP-OCRv5 detection boxes frequently merge Aadhaar's Name/Gender/YOB
  // column into a single line. The extractor must strip the field tokens
  // and return the real name, not the boilerplate.
  describe('aadhaar merged-field name lines', () => {
    it('strips a gender word merged onto the name line', () => {
      const text = 'NAME\nRAHUL KUMAR MALE\nGENDER: MALE\n5555 6666 7777';
      const result = parseIdDocument(text);
      expect(result.name).toBe('RAHUL KUMAR');
      expect(result.type).toBe('aadhaar');
    });

    it('strips YOB/Year-of-birth text merged onto the name line', () => {
      // The line after the label carries the merged YOB suffix with digits —
      // extraction must drop that suffix and keep the name.
      const text = 'NAME\nRAHUL KUMAR YOB 1998\n5555 6666 7777';
      const result = parseIdDocument(text);
      expect(result.name).toBe('RAHUL KUMAR');
    });

    it('does not mistake MALE alone (label-less scan) for a name', () => {
      const text = 'GOVERNMENT OF INDIA\nMALE\n5555 6666 7777';
      const result = parseIdDocument(text);
      expect(result.name).toBeNull();
    });
  });

  describe('detection precedence', () => {
    it('PAN takes precedence over Aadhaar when both are present', () => {
      const text = 'ABCDE1234F\n1234 5678 9012';
      const result = parseIdDocument(text);
      expect(result.type).toBe('pan');
      expect(result.rawNumber).toBe('ABCDE1234F');
    });

    it('Aadhaar takes precedence over Passport when both present', () => {
      const text = 'A1234567\n2345 6789 0123';
      const result = parseIdDocument(text);
      expect(result.type).toBe('aadhaar');
    });

    it('Passport takes precedence over DL when both present', () => {
      const text = 'A1234567\nMH12 20110012345';
      const result = parseIdDocument(text);
      expect(result.type).toBe('passport');
    });

    it('PAN takes precedence over DL even if DL appears first', () => {
      const text = 'MH12 20110012345\nABCDE1234F';
      const result = parseIdDocument(text);
      expect(result.type).toBe('pan');
    });
  });

  describe('name extraction', () => {
    const boilerplate = new Set([
      'GOVERNMENT OF INDIA', 'INCOME TAX DEPARTMENT',
      'UNIQUE IDENTIFICATION AUTHORITY OF INDIA', 'PERMANENT ACCOUNT NUMBER',
      'PERMANENT ACCOUNT NUMBER CARD', 'INDIAN UNION DRIVING LICENCE',
    ]);

    it('extracts name after an English NAME label on the same line', () => {
      const result = parseIdDocument('NAME: John Smith\nABCDE1234F');
      expect(result.name).toBe('John Smith');
    });

    it('extracts name after a Hindi नाम label', () => {
      const result = parseIdDocument('नाम: John Smith\nABCDE1234F');
      expect(result.name).toBe('John Smith');
    });

    it('extracts name on the line after a NAME label', () => {
      const text = 'NAME\nJohn Smith\nABCDE1234F';
      const result = parseIdDocument(text);
      expect(result.name).toBe('John Smith');
    });

    it('returns null when NAME label is followed by boilerplate', () => {
      const text = 'NAME\nGOVERNMENT OF INDIA\nABCDE1234F';
      const result = parseIdDocument(text);
      expect(result.name).toBeNull();
    });

    it('returns null when no plausible name is found', () => {
      const result = parseIdDocument('ABCDE1234F\n2026-01-01');
      expect(result.name).toBeNull();
    });

    it('does not mistake boilerplate lines for a name', () => {
      for (const line of boilerplate) {
        const result = parseIdDocument(`${line}\nABCDE1234F`);
        expect(result.name).toBeNull();
      }
    });

    it('accepts names with dots and lowercase', () => {
      const result = parseIdDocument('NAME: john.doe\nABCDE1234F');
      expect(result.name).toBe('john.doe');
    });

    it('rejects names shorter than 3 chars', () => {
      const result = parseIdDocument('NAME: Jo\nABCDE1234F');
      expect(result.name).toBeNull();
    });

    it('rejects names with digits', () => {
      const result = parseIdDocument('NAME: John 123\nABCDE1234F');
      expect(result.name).toBeNull();
    });
  });

  describe('date of birth extraction', () => {
    it('extracts DOB from a DD/MM/YYYY after a DOB label', () => {
      const result = parseIdDocument('DOB: 15/06/1990\nABCDE1234F');
      expect(result.dateOfBirth).toBe('1990-06-15');
    });

    it('extracts DOB from a DD-MM-YYYY format', () => {
      const result = parseIdDocument('DOB: 15-06-1990\nABCDE1234F');
      expect(result.dateOfBirth).toBe('1990-06-15');
    });

    it('extracts DOB from the line after a DOB label', () => {
      const text = 'DATE OF BIRTH\n15/06/1990\nABCDE1234F';
      const result = parseIdDocument(text);
      expect(result.dateOfBirth).toBe('1990-06-15');
    });

    it('extracts DOB after a Hindi जन्म label', () => {
      const result = parseIdDocument('जन्म: 15/06/1990\nABCDE1234F');
      expect(result.dateOfBirth).toBe('1990-06-15');
    });

    it('pads single-digit day and month', () => {
      const result = parseIdDocument('DOB: 5/6/1990\nABCDE1234F');
      expect(result.dateOfBirth).toBe('1990-06-05');
    });

    it('rejects an impossible date (Feb 31)', () => {
      const result = parseIdDocument('DOB: 31/02/1990\nABCDE1234F');
      expect(result.dateOfBirth).toBeNull();
    });

    it('rejects an impossible date (Apr 31)', () => {
      const result = parseIdDocument('DOB: 31/04/1990\nABCDE1234F');
      expect(result.dateOfBirth).toBeNull();
    });

    it('rejects an invalid month (13)', () => {
      const result = parseIdDocument('DOB: 15/13/1990\nABCDE1234F');
      expect(result.dateOfBirth).toBeNull();
    });

    it('rejects a future date of birth', () => {
      const futureYear = new Date().getFullYear() + 5;
      const result = parseIdDocument(`DOB: 15/06/${futureYear}\nABCDE1234F`);
      expect(result.dateOfBirth).toBeNull();
    });

    it('returns null for a bare year next to DOB label', () => {
      const result = parseIdDocument('DOB: 1990\nABCDE1234F');
      expect(result.dateOfBirth).toBeNull();
    });

    it('falls back to the first well-formed date when no DOB label exists', () => {
      const result = parseIdDocument('Issue Date: 20/01/2020\nABCDE1234F');
      expect(result.dateOfBirth).toBe('2020-01-20');
    });

    it('returns null when no date is present', () => {
      const result = parseIdDocument('NAME: John Smith\nABCDE1234F');
      expect(result.dateOfBirth).toBeNull();
    });
  });

  describe('full document scenarios', () => {
    it('parses a typical PAN card', () => {
      const text = [
        'INCOME TAX DEPARTMENT',
        'PERMANENT ACCOUNT NUMBER',
        'ABCDE1234F',
        'NAME: Jane Smith',
        'DOB: 15/06/1990',
      ].join('\n');
      const result = parseIdDocument(text);
      expect(result.type).toBe('pan');
      expect(result.rawNumber).toBe('ABCDE1234F');
      expect(result.name).toBe('Jane Smith');
      expect(result.dateOfBirth).toBe('1990-06-15');
    });

    it('parses a typical Aadhaar card', () => {
      const text = [
        'UNIQUE IDENTIFICATION AUTHORITY OF INDIA',
        'Aadhaar',
        '2345 6789 0123',
        'NAME: Rohan Patel',
        'DOB: 05/12/1985',
      ].join('\n');
      const result = parseIdDocument(text);
      expect(result.type).toBe('aadhaar');
      expect(result.rawNumber).toBe('2345 6789 0123');
      expect(result.name).toBe('Rohan Patel');
      expect(result.dateOfBirth).toBe('1985-12-05');
    });

    it('preserves original casing in rawNumber', () => {
      const result = parseIdDocument('abcde1234f');
      expect(result.rawNumber).toBe('abcde1234f');
    });
  });
});
