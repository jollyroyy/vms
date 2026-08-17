// The two PERSON fields an Indian ID card carries — the holder's name and their
// date of birth — split out of `idParser.ts` so that file stays under the 300-line
// rule and keeps one concern: WHICH DOCUMENT is this and what is its number.
// This file answers WHO it belongs to. `parseIdDocument` is still the only entry
// point; nothing outside it calls these.
//
// Both functions return null rather than a guess. A wrong name on a gate record
// is worse than an absent one: `namesMatch` compares the scanned name against
// the approved visitor and BLOCKS the check-in on a mismatch, so a fabricated
// name would refuse a legitimate visitor, and a boilerplate line lifted off the
// card ("ELECTION COMMISSION OF INDIA") would do it every single time.

// ---------------------------------------------------------------- name

const NAME_LABEL_PATTERN = /^(NAME|नाम)\s*[:\-]?\s*(.*)$/i;

// Boilerplate printed on every card of a given type — never a person's name.
const BOILERPLATE_LINES = new Set([
  'GOVERNMENT OF INDIA',
  'GOVT OF INDIA',
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
  // Voter card (EPIC) boilerplate. Without these the name fallback below — the
  // first name-shaped Latin line — would hand back the issuing authority as the
  // holder's name on every voter card, which is worse than returning nothing.
  'ELECTION COMMISSION OF INDIA',
  'ELECTOR PHOTO IDENTITY CARD',
  'IDENTITY CARD',
  'ELECTORS NAME',
  // Aadhaar-specific field words that OCR routinely merges onto the name
  // line (PP-OCRv5 detection boxes merge adjacent glyphs): a "name" line
  // equal to any of these is a field label, not a person.
  'MALE',
  'FEMALE',
  'GENDER',
  'YEAR OF BIRTH',
  'ADDRESS',
  'DOB',
]);

const ALPHA_NAME_PATTERN = /^[A-Za-z][A-Za-z\s.]{2,}$/;

// Aadhaar packs Name/Gender/YOB in a tight column, so OCR frequently reads
// them as ONE line: "RAHUL KUMAR MALE" or "RAHUL KUMAR YOB 1998". These are
// stripped before the line is treated as a name — the real name never
// contains digits or gender words, and the matcher downstream tolerates the
// loss of one trailing token because it compares word sets.
const TRAILING_TOKENS = /\b(YOB|YEAR|MALE|FEMALE|DOB)\b.*$/i;

// A card's secondary script line (Devanagari on Aadhaar) can be detected as a
// candidate. It is never the return value: keep only Latin lines. Note: the
// digit rule is applied AFTER trailing-token stripping — OCR on Aadhaar
// commonly fuses "RAHUL KUMAR YOB 1998" into one line, and the digits belong
// to the year suffix, not the name.
const LATIN_NAME_PATTERN = /^[A-Za-z][A-Za-z\s.]{2,}$/;

function isPlausibleName(candidate: string): boolean {
  if (candidate.length < 3) return false;
  if (!LATIN_NAME_PATTERN.test(candidate)) return false;
  if (BOILERPLATE_LINES.has(candidate.toUpperCase())) return false;
  return true;
}

function cleanNameLine(raw: string): string | null {
  const line = raw.trim();
  if (!line) return null;
  if (BOILERPLATE_LINES.has(line.toUpperCase())) return null;
  // Drop merged Aadhaar field tokens appended to the name line. "RAHUL KUMAR
  // MALE" → "RAHUL KUMAR"; "RAHUL KUMAR YOB 1998" → "RAHUL KUMAR". A genuine
  // name ending in a gender/field word is implausible, so stripping before
  // the shape check is safe — and it is what lets the digits-bearing merged
  // suffix pass removal (digits are only allowed inside the stripped part).
  const cleaned = line.replace(TRAILING_TOKENS, '').trim();
  if (cleaned.length < 3 || !LATIN_NAME_PATTERN.test(cleaned)) return null;
  return cleaned;
}

export function extractName(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    const labelMatch = NAME_LABEL_PATTERN.exec(line);
    if (!labelMatch) continue;

    const inline = cleanNameLine(labelMatch[2] ?? '');
    if (inline) return inline;

    // Many Aadhaar/PAN cards print the label and the name on separate lines.
    for (let j = i + 1; j < lines.length; j++) {
      const cleaned = cleanNameLine(lines[j] ?? '');
      if (cleaned) return cleaned;
      const candidate = (lines[j] ?? '').trim();
      if (candidate) break; // the next non-empty line wasn't name-shaped — stop
    }
    // A "Name" label was found but nothing plausible followed it: better to
    // report nothing than to hand back boilerplate or a stray line.
    return null;
  }

  // No label anywhere — fall back to the first name-shaped, non-boilerplate
  // Latin line (skipping Devanagari and merged-field lines that cleanNameLine
  // rejects).
  for (const rawLine of lines) {
    const cleaned = cleanNameLine(rawLine);
    if (cleaned) return cleaned;
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

export function extractDateOfBirth(lines: string[], now: Date): string | null {
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
