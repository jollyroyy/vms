// Turns raw OCR text (src/lib/ai/ocrEngine.ts's newline-joined `fullText`) into
// structured Indian government ID fields. Pure logic only: no DOM, no network,
// no model calls. The caller decides what to do with the result — this file
// only decides what the text says.
//
// A wrong auto-filled field is worse than an empty one a guard can type in by
// hand, so every extractor below is written to prefer `null` over a guess it
// isn't confident about.

export type IdDocumentType = 'aadhaar' | 'pan' | 'driving_licence' | 'passport' | 'unknown';

export type ParsedId = {
  type: IdDocumentType;
  /** Full ID number exactly as read. NEVER persist this — see redact.ts. */
  rawNumber: string | null;
  name: string | null;
  dateOfBirth: string | null; // ISO 'YYYY-MM-DD' when confidently parsed, else null
};

// ---------------------------------------------------------------- detection

// PAN: 5 letters + 4 digits + 1 letter, no spaces — the only one of the four
// formats with a fixed, unambiguous letter/digit skeleton. Checked first so a
// PAN card is never mistaken for a coincidental 12-digit Aadhaar run (PAN
// numbers contain digits but never 12 of them in a row, yet a stray sequence
// elsewhere on the same card could still look like one).
const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;

// Aadhaar: 12 digits, usually printed as three groups of 4. Matched as a
// generic 12-digit run and then filtered in code (not the regex) so the
// leading-digit rule below has a clear, independently testable home.
const AADHAAR_CANDIDATE_PATTERN = /(?<!\d)\d{4}\s?\d{4}\s?\d{4}(?!\d)/g;

// Passport: 1 letter + 7 digits (Indian format).
const PASSPORT_PATTERN = /\b[A-Z][0-9]{7}\b/;

// Driving licence: two-letter state code, optional separator, then digits —
// e.g. 'MH12 20110012345', 'DL-0420110149646', 'KA0520190001234'. This is the
// loosest of the four shapes (it would happily swallow a passport or DL-like
// substring of another field), so it is tried last, only once nothing more
// specific has matched.
const DL_PATTERN = /\b[A-Z]{2}[\s-]?\d{2}[\s-]?\d{4,11}\b/;

// Precedence: PAN > Aadhaar > Passport > DL.
//   1. PAN's alternating letter/digit skeleton is the most specific pattern
//      of the four, so it is ruled in or out first.
//   2. Aadhaar's 12-digit run is next most specific once PAN is excluded.
//   3. Passport's single-letter-plus-7-digits is more specific than DL's
//      variable-length, 2-11 digit tail.
//   4. DL is checked last because its pattern is the loosest and would
//      otherwise cannibalise matches meant for the others.
type Detection = { type: IdDocumentType; rawNumber: string | null };

function detectDocument(upperText: string, originalText: string): Detection {
  const pan = PAN_PATTERN.exec(upperText);
  if (pan) return { type: 'pan', rawNumber: sliceOriginal(originalText, pan.index, pan[0].length) };

  const aadhaar = findAadhaar(upperText, originalText);
  if (aadhaar) return { type: 'aadhaar', rawNumber: aadhaar };

  const passport = PASSPORT_PATTERN.exec(upperText);
  if (passport) {
    return { type: 'passport', rawNumber: sliceOriginal(originalText, passport.index, passport[0].length) };
  }

  const dl = DL_PATTERN.exec(upperText);
  if (dl) return { type: 'driving_licence', rawNumber: sliceOriginal(originalText, dl.index, dl[0].length) };

  return { type: 'unknown', rawNumber: null };
}

function findAadhaar(upperText: string, originalText: string): string | null {
  const matches = upperText.matchAll(AADHAAR_CANDIDATE_PATTERN);
  for (const match of matches) {
    const candidate = match[0];
    const digitsOnly = candidate.replace(/\D/g, '');
    if (digitsOnly.length !== 12) continue;
    const firstDigit = digitsOnly[0];
    // UIDAI reserves 0 and 1 as leading digits, so a run starting with either
    // is some other 12-digit number (phone, reference, serial) that merely
    // happens to have the right length — not an Aadhaar number.
    if (firstDigit === '0' || firstDigit === '1') continue;
    return sliceOriginal(originalText, match.index ?? 0, candidate.length);
  }
  return null;
}

/** Uppercasing never changes string length for the Latin text these patterns
 *  match, so match indices from the uppercased copy line up with the
 *  original — this recovers the number in its as-printed casing/spacing. */
function sliceOriginal(originalText: string, index: number, length: number): string {
  return originalText.slice(index, index + length);
}

// ---------------------------------------------------------------- name

const NAME_LABEL_PATTERN = /^(NAME|नाम)\s*[:\-]?\s*(.*)$/i;

// Boilerplate printed on every card of a given type — never a person's name.
const BOILERPLATE_LINES = new Set([
  'GOVERNMENT OF INDIA',
  'INCOME TAX DEPARTMENT',
  'UNIQUE IDENTIFICATION AUTHORITY OF INDIA',
  'PERMANENT ACCOUNT NUMBER',
  'PERMANENT ACCOUNT NUMBER CARD',
  'INDIAN UNION DRIVING LICENCE',
  'UNION OF INDIA',
  'REPUBLIC OF INDIA',
  'DEPARTMENT',
  'INDIA',
  'PASSPORT',
  'DRIVING LICENCE',
  'TRANSPORT DEPARTMENT',
]);

const ALPHA_NAME_PATTERN = /^[A-Za-z][A-Za-z\s.]{2,}$/;

function isPlausibleName(candidate: string): boolean {
  if (candidate.length < 3) return false;
  if (!ALPHA_NAME_PATTERN.test(candidate)) return false;
  if (BOILERPLATE_LINES.has(candidate.toUpperCase())) return false;
  return true;
}

function extractName(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    const labelMatch = NAME_LABEL_PATTERN.exec(line);
    if (!labelMatch) continue;

    const inline = (labelMatch[2] ?? '').trim();
    if (inline && isPlausibleName(inline)) return inline;

    // Many Aadhaar/PAN cards print the label and the name on separate lines.
    for (let j = i + 1; j < lines.length; j++) {
      const candidate = (lines[j] ?? '').trim();
      if (!candidate) continue;
      if (isPlausibleName(candidate)) return candidate;
      break; // the next non-empty line wasn't name-shaped — don't keep guessing
    }
    // A "Name" label was found but nothing plausible followed it: better to
    // report nothing than to hand back boilerplate or a stray line.
    return null;
  }

  // No label anywhere — fall back to the first name-shaped, non-boilerplate line.
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (isPlausibleName(line)) return line;
  }
  return null;
}

// ---------------------------------------------------------------- date of birth

const DATE_LABEL_PATTERN = /(DOB|DATE OF BIRTH|D\.O\.B|जन्म)/i;
// Indian cards are DAY-first: DD/MM/YYYY or DD-MM-YYYY. Captured loosely
// (1-2 digit day/month) and validated numerically below.
const FULL_DATE_PATTERN = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/;

function tryParseFullDate(line: string, now: Date): string | null {
  const match = FULL_DATE_PATTERN.exec(line);
  if (!match) return null;
  const dayStr = match[1];
  const monthStr = match[2];
  const yearStr = match[3];
  if (!dayStr || !monthStr || !yearStr) return null;
  return toIsoIfValid(Number(dayStr), Number(monthStr), Number(yearStr), now);
}

function toIsoIfValid(day: number, month: number, year: number, now: Date): string | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC "rolls over" invalid combinations (e.g. 31 Feb -> 3 Mar) instead
  // of throwing — comparing the parts back out is how we catch that and
  // reject the date as never having been real.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  if (date.getTime() > now.getTime()) return null; // a future date of birth is never valid

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function extractDateOfBirth(lines: string[], now: Date): string | null {
  // Prefer a date on (or immediately after) a DOB-labelled line, so an issue
  // date or expiry date printed elsewhere on the card is never picked up
  // ahead of the actual date of birth.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!DATE_LABEL_PATTERN.test(line)) continue;

    const onLine = tryParseFullDate(line, now);
    if (onLine) return onLine;

    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j] ?? '';
      if (!candidate.trim()) continue;
      const onNext = tryParseFullDate(candidate, now);
      if (onNext) return onNext;
      break;
    }

    // Some Aadhaar cards print only the birth YEAR next to the label. A year
    // alone cannot become a valid ISO calendar date, so this is a deliberate
    // null rather than a fabricated 01-01 of that year.
    return null;
  }

  // No label found anywhere — fall back to the first well-formed date on the document.
  for (const line of lines) {
    const found = tryParseFullDate(line, now);
    if (found) return found;
  }
  return null;
}

// ---------------------------------------------------------------- entry point

export function parseIdDocument(text: string): ParsedId {
  const trimmed = text.trim();
  if (!trimmed) {
    return { type: 'unknown', rawNumber: null, name: null, dateOfBirth: null };
  }

  // Normalise casing for matching only — the original text (and its spacing)
  // is what gets sliced out for rawNumber and name, so grouping like
  // '1234 5678 9012' and a name's original casing both survive intact.
  const upperText = trimmed.toUpperCase();
  const lines = trimmed.split('\n');

  const detection = detectDocument(upperText, trimmed);
  const name = extractName(lines);
  const dateOfBirth = extractDateOfBirth(lines, new Date());

  return {
    type: detection.type,
    rawNumber: detection.rawNumber,
    name,
    dateOfBirth,
  };
}
