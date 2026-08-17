// Covers parseIdDocument's DOCUMENT-TYPE DETECTION: empty/whitespace input,
// PAN/Aadhaar/Passport/Driving-licence recognition, and the precedence order
// when more than one ID-shaped number appears in the same text. Field
// extraction (name, date of birth, merged-field OCR lines, and full-document
// scenarios) lives in the sibling file idParserExtraction.test.ts.
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

  // The scan accepts ANY government photo ID, not only Aadhaar (client
  // instruction, 2026-08-17). The Voter ID was the one of the five printed on
  // an Indian card that this parser could not name: an EPIC number is three
  // letters and seven digits, which none of the other four patterns match, so
  // a voter card scanned as `unknown` and the overlay refused it outright.
  describe('Voter ID (EPIC) detection', () => {
    it('detects an EPIC number (3 letters + 7 digits)', () => {
      const result = parseIdDocument('ABC1234567');
      expect(result.type).toBe('voter_id');
      expect(result.rawNumber).toBe('ABC1234567');
    });

    it('detects an EPIC number embedded in card text', () => {
      const text = 'ELECTION COMMISSION OF INDIA\nELECTOR PHOTO IDENTITY CARD\nWXY9876543\nNAME: John Doe';
      const result = parseIdDocument(text);
      expect(result.type).toBe('voter_id');
      expect(result.rawNumber).toBe('WXY9876543');
    });

    it('does not read a passport number as an EPIC', () => {
      expect(parseIdDocument('A1234567').type).toBe('passport');
    });

    it('does not read a PAN as an EPIC', () => {
      expect(parseIdDocument('ABCDE1234F').type).toBe('pan');
    });

    it('does not report a voter card as a driving licence', () => {
      // DL's pattern is the loosest of the five and is tried last precisely so
      // it cannot cannibalise a more specific shape.
      expect(parseIdDocument('MNO4567890').type).toBe('voter_id');
    });

    it('does not treat the card boilerplate as the holder name', () => {
      const text = 'ELECTION COMMISSION OF INDIA\nELECTOR PHOTO IDENTITY CARD\nABC1234567';
      expect(parseIdDocument(text).name).toBeNull();
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
});
