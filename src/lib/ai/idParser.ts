// Turns raw OCR text (src/lib/ai/ocrEngine.ts's newline-joined `fullText`) into
// structured Indian government ID fields. Pure logic only: no DOM, no network,
// no model calls. The caller decides what to do with the result — this file
// only decides what the text says.
//
// A wrong auto-filled field is worse than an empty one a guard can type in by
// hand, so every extractor below is written to prefer `null` over a guess it
// isn't confident about.

import { extractName, extractDateOfBirth } from './idParserFields';

export type IdDocumentType =
  | 'aadhaar'
  | 'pan'
  | 'voter_id'
  | 'driving_licence'
  | 'passport'
  | 'unknown';

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

// Voter ID (EPIC): 3 letters + 7 digits, e.g. 'ABC1234567'. Disjoint from every
// other shape here rather than merely ranked below them — a passport carries ONE
// leading letter and a PAN five, so neither can satisfy `{3}`, and the DL pattern
// needs a digit in the third position where an EPIC still has a letter. The
// visitor desk accepts any government photo ID, so leaving this out meant a voter
// card came back `unknown` and the overlay refused a document the guard was
// holding and was entitled to accept.
const VOTER_ID_PATTERN = /\b[A-Z]{3}[0-9]{7}\b/;

// Driving licence: two-letter state code, optional separator, then digits —
// e.g. 'MH12 20110012345', 'DL-0420110149646', 'KA0520190001234'. This is the
// loosest of the four shapes (it would happily swallow a passport or DL-like
// substring of another field), so it is tried last, only once nothing more
// specific has matched.
const DL_PATTERN = /\b[A-Z]{2}[\s-]?\d{2}[\s-]?\d{4,11}\b/;

// Precedence: PAN > Aadhaar > Passport > Voter ID > DL.
//   1. PAN's alternating letter/digit skeleton is the most specific pattern
//      of the four, so it is ruled in or out first.
//   2. Aadhaar's 12-digit run is next most specific once PAN is excluded.
//   3. Passport's single-letter-plus-7-digits is more specific than DL's
//      variable-length, 2-11 digit tail.
//   4. Voter ID's 3-letters-plus-7-digits is fixed-length and cannot overlap
//      any of the three above, so its position is only about staying ahead of
//      DL.
//   5. DL is checked last because its pattern is the loosest and would
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

  const voter = VOTER_ID_PATTERN.exec(upperText);
  if (voter) {
    return { type: 'voter_id', rawNumber: sliceOriginal(originalText, voter.index, voter[0].length) };
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
