// Character and length rules for admin-entered text (departments, HODs).
//
// WHY AN ALLOWLIST, NOT A BLOCKLIST OF "BAD" STRINGS: there is no attempt here to
// spot `<script>` or `DROP TABLE`. Blocklists are guessing games. These rules say
// what a department or a person's name may CONTAIN, and everything else — angle
// brackets, quotes, semicolons, backslashes, braces, control characters, emoji —
// is refused because it was never on the list.
//
// WHAT THIS IS AND IS NOT PROTECTING AGAINST:
//  - SQL injection: already structurally impossible. Every write goes through
//    supabase-js → PostgREST, which parameterises values; nothing in this app
//    concatenates SQL. These rules are defence in depth, not the defence.
//  - XSS: React escapes all interpolated text, and the app has no
//    dangerouslySetInnerHTML. Again, depth.
//  - The real wins are data hygiene: no unbounded input, no invisible control
//    characters, no homoglyph/emoji department names, no leading/trailing space.
//
// The same rules exist as CHECK constraints in migration 062, because a rule that
// lives only in the browser is a usability guard, not a boundary.

export const DEPT_NAME_MIN = 2;
export const DEPT_NAME_MAX = 60;
export const DEPT_CODE_MAX = 10;
export const PERSON_NAME_MIN = 2;
export const PERSON_NAME_MAX = 80;

/** Letters, digits, space, and the four separators real department names use. */
export const DEPT_NAME_RE = /^[A-Za-z0-9 &./'-]+$/;

/**
 * Codes are uppercase identifiers. `&` and `-` are allowed because the live
 * project already has a department coded `R&D` — a rule that invalidates
 * existing production data is a rule that gets switched off.
 */
export const DEPT_CODE_RE = /^[A-Z0-9&-]+$/;

/** Person names: letters and the punctuation inside real names. No digits. */
export const PERSON_NAME_RE = /^[A-Za-z .'-]+$/;

/** Collapses internal runs of whitespace and trims the ends. */
export function squashSpace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Control characters are stripped before any other check. They are invisible, so
 * a validation message about them would read as nonsense, and a name containing
 * one can never be matched or searched for again.
 */
export function stripControlChars(value: string): string {
  // A codepoint filter, not a regex: a control-character class written as a
  // literal puts real control bytes into this source file.
  return [...value]
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return c > 0x1f && c !== 0x7f && !(c >= 0x80 && c <= 0x9f);
    })
    .join('');
}

type RuleOptions = {
  label: string;
  min: number;
  max: number;
  pattern: RegExp;
  allowed: string;
};

/** Returns a human-readable error, or null when the value satisfies the rule. */
function checkAgainst(value: string, o: RuleOptions): string | null {
  if (!value) return `${o.label} is required.`;
  if (value.length < o.min) return `${o.label} must be at least ${o.min} characters.`;
  if (value.length > o.max) return `${o.label} must be ${o.max} characters or fewer.`;
  if (!o.pattern.test(value)) {
    // Name the offending character. "Invalid characters" sends an admin hunting
    // through a string they cannot see anything wrong with.
    const bad = [...value].find((ch) => !o.pattern.test(ch));
    const shown = bad && bad.trim() ? `"${bad}"` : 'that character';
    return `${o.label} cannot contain ${shown}. Use ${o.allowed}.`;
  }
  return null;
}

export function departmentNameError(value: string): string | null {
  return checkAgainst(squashSpace(stripControlChars(value)), {
    label: 'Department name',
    min: DEPT_NAME_MIN,
    max: DEPT_NAME_MAX,
    pattern: DEPT_NAME_RE,
    allowed: "letters, numbers, spaces and & . ' / -",
  });
}

export function departmentCodeError(value: string): string | null {
  return checkAgainst(stripControlChars(value).replace(/\s+/g, '').toUpperCase(), {
    label: 'Department code',
    min: 1,
    max: DEPT_CODE_MAX,
    pattern: DEPT_CODE_RE,
    allowed: 'letters, numbers, & and -',
  });
}

export function personNameError(value: string, label = 'Name'): string | null {
  return checkAgainst(squashSpace(stripControlChars(value)), {
    label,
    min: PERSON_NAME_MIN,
    max: PERSON_NAME_MAX,
    pattern: PERSON_NAME_RE,
    allowed: "letters, spaces and . ' -",
  });
}

/**
 * Escapes the LIKE metacharacters in a user-supplied search term.
 *
 * NOT an injection fix — PostgREST parameterises the value either way. Without
 * it, a search for `%` is a valid pattern that matches EVERY row, which turns a
 * name lookup into a full directory dump.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
