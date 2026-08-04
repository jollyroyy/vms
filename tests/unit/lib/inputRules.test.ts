import { describe, it, expect } from 'vitest';
import {
  DEPT_NAME_MIN,
  DEPT_NAME_MAX,
  DEPT_CODE_MAX,
  PERSON_NAME_MIN,
  PERSON_NAME_MAX,
  DEPT_NAME_RE,
  DEPT_CODE_RE,
  PERSON_NAME_RE,
  squashSpace,
  stripControlChars,
  departmentNameError,
  departmentCodeError,
  personNameError,
  escapeLikePattern,
} from '../../../src/lib/inputRules';

describe('exported constants and patterns', () => {
  it('have the documented values', () => {
    expect(DEPT_NAME_MIN).toBe(2);
    expect(DEPT_NAME_MAX).toBe(60);
    expect(DEPT_CODE_MAX).toBe(10);
    expect(PERSON_NAME_MIN).toBe(2);
    expect(PERSON_NAME_MAX).toBe(80);
  });

  it('regexes match the characters they claim to allow', () => {
    expect(DEPT_NAME_RE.test("O'Brien & Sons / R&D-1")).toBe(true);
    expect(DEPT_CODE_RE.test('R&D-1')).toBe(true);
    expect(PERSON_NAME_RE.test("Mary-Jane O'Brien")).toBe(true);
  });
});

describe('departmentNameError', () => {
  it.each([
    'Human Resources',
    'R&D',
    'Legal/Compliance',
    "O'Brien Group",
    'Ops 2',
    'IT-Support',
    'QA',
  ])('accepts %s', (value) => {
    expect(departmentNameError(value)).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(departmentNameError('')).not.toBeNull();
  });

  it('rejects a whitespace-only string', () => {
    expect(departmentNameError('   ')).not.toBeNull();
  });

  it('rejects a name below the minimum length', () => {
    expect(departmentNameError('A')).not.toBeNull();
  });

  it('rejects a name above the maximum length', () => {
    expect(departmentNameError('A'.repeat(61))).not.toBeNull();
  });

  it.each([
    '<script>alert(1)</script>',
    "Robert'); DROP TABLE departments;--",
    'Ops \u{1F680}',
    'Ops\u2122',
    'a"b',
    'a;b',
    'a\\b',
    'a{b}',
  ])('rejects %s', (value) => {
    expect(departmentNameError(value)).not.toBeNull();
  });

  it('names the offending character in the message', () => {
    expect(departmentNameError('Ops<x')).toContain('<');
  });
});

describe('departmentCodeError', () => {
  it.each(['HR', 'R&D', 'IT2', 'A-B', 'hr'])('accepts %s', (value) => {
    expect(departmentCodeError(value)).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(departmentCodeError('')).not.toBeNull();
  });

  it('rejects a code above the maximum length', () => {
    expect(departmentCodeError('A'.repeat(11))).not.toBeNull();
  });

  it.each(['H R!', 'H@R', '<b>'])('rejects %s', (value) => {
    expect(departmentCodeError(value)).not.toBeNull();
  });
});

describe('personNameError', () => {
  it.each(['Asha Rao', "O'Brien", 'Mary-Jane Watson', 'Dr. Rao'])('accepts %s', (value) => {
    expect(personNameError(value)).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(personNameError('')).not.toBeNull();
  });

  it('rejects a name below the minimum length', () => {
    expect(personNameError('A')).not.toBeNull();
  });

  it('rejects a name above the maximum length', () => {
    expect(personNameError('A'.repeat(81))).not.toBeNull();
  });

  it('rejects digits in a person name', () => {
    expect(personNameError('Bugfix Test 2')).not.toBeNull();
  });

  it.each(['<script>', 'a;b'])('rejects %s', (value) => {
    expect(personNameError(value)).not.toBeNull();
  });

  it('uses the custom label in the error message', () => {
    const message = personNameError('', 'HOD name');
    expect(message).not.toBeNull();
    expect(message).toContain('HOD name');
  });
});

describe('squashSpace', () => {
  it('trims ends and collapses internal whitespace runs', () => {
    expect(squashSpace('  a   b  ')).toBe('a b');
  });
});

describe('stripControlChars', () => {
  it('removes a NUL codepoint', () => {
    expect(stripControlChars('a\u0000bc')).toBe('abc');
  });

  it('removes a DEL codepoint', () => {
    expect(stripControlChars('a\u007Fbc')).toBe('abc');
  });

  it('removes tab and newline', () => {
    expect(stripControlChars('a\tb\nc')).toBe('abc');
  });

  it('removes a C1 control codepoint', () => {
    expect(stripControlChars('a\u009Fb')).toBe('ab');
  });

  it('leaves ordinary printable text untouched', () => {
    expect(stripControlChars('Asha Rao')).toBe('Asha Rao');
  });
});

describe('escapeLikePattern', () => {
  it('escapes %, _ and backslash', () => {
    expect(escapeLikePattern('%')).toBe('\\%');
    expect(escapeLikePattern('_')).toBe('\\_');
    expect(escapeLikePattern('\\')).toBe('\\\\');
  });

  it('leaves a plain search term unchanged', () => {
    expect(escapeLikePattern('asha')).toBe('asha');
  });

  it('documents why: an unescaped % is a wildcard matching every row', () => {
    // Without escaping, searching for a literal "%" would be handed to LIKE as
    // a wildcard meaning "zero or more of anything" -- every row would match,
    // turning a name lookup into a full directory dump.
    expect(escapeLikePattern('50% done')).toBe('50\\% done');
  });
});

describe('rejects the payload classes the DB constraints reject', () => {
  it('rejects a script tag', () => {
    expect(departmentNameError('<script>alert(1)</script>')).not.toBeNull();
  });

  it('rejects a SQL-injection-shaped string', () => {
    expect(departmentNameError("'; DROP TABLE departments;--")).not.toBeNull();
  });

  it('a lone embedded control char is stripped before validation, so the surrounding text can still pass if valid on its own', () => {
    // stripControlChars removes the embedded NUL entirely, leaving "ab" -- a
    // valid 2-character department name. The control character is neutralised
    // (it can never end up stored), but it does not itself make the value
    // invalid once removed. Documenting the real behaviour, not an assumed one.
    expect(departmentNameError('a\u0000b')).toBeNull();
  });
});
