// Aadhaar Act, 2016, Section 29: a private company that stores someone's full
// Aadhaar number without authorisation commits a criminal offence — up to 3
// years' imprisonment plus a fine. Only the LAST 4 digits may be retained;
// the leading 8 must be masked before anything reaches persistent storage.
// This file is the single enforcement point for that rule — nothing else in
// the app should decide what "safe to store" means for an ID number.
//
// See PRODUCTION-GOTCHAS.md GOTCHA-2 for the full writeup, including why the
// redaction flag currently ships OFF in development.

/** Strips everything but letters/digits and returns the last 4 characters
 *  (fewer if the input is shorter than 4). Used both to build the masked
 *  display string and as the only form of the number that may be stored. */
export function lastFourOf(rawNumber: string): string {
  const stripped = rawNumber.replace(/[^A-Za-z0-9]/g, '');
  return stripped.slice(-4);
}

/** Masks every alphanumeric character except the last 4, preserving the
 *  input's own spacing/dashes so 'XXXX XXXX 9012' still reads as an Aadhaar
 *  number and 'XX-XX-...9646' still reads as a DL number. */
export function maskIdNumber(rawNumber: string): string {
  const alnumIndices: number[] = [];
  for (let i = 0; i < rawNumber.length; i++) {
    const ch = rawNumber[i];
    if (ch && /[A-Za-z0-9]/.test(ch)) alnumIndices.push(i);
  }
  const keepFromPosition = Math.max(0, alnumIndices.length - 4);
  const keepIndices = new Set(alnumIndices.slice(keepFromPosition));

  let masked = '';
  for (let i = 0; i < rawNumber.length; i++) {
    const ch = rawNumber[i] ?? '';
    if (!/[A-Za-z0-9]/.test(ch)) {
      masked += ch;
    } else {
      masked += keepIndices.has(i) ? ch : 'X';
    }
  }
  return masked;
}

// Same pattern as src/lib/featureFlags.ts, and for the same two reasons:
//  * Vite decides whether a module gets an `import.meta.env` object at all by
//    statically scanning its source for the literal `import.meta.env.VITE_...`
//    text, so the key must be spelled out here rather than looked up
//    dynamically — a computed/optional-chained lookup silently reads
//    undefined in the browser, and Vitest's always-populated env would not
//    catch it.
//  * The read happens inside a function (not resolved once at module load)
//    so tests can stub the environment with vi.stubEnv after this module has
//    already been imported.
//
// Fail-closed: anything other than the exact string 'true' means redaction is
// OFF. That is deliberate for this MVP — see PRODUCTION-GOTCHAS.md GOTCHA-2 —
// so a typo can only ever under-protect a developer's own test data, never
// silently disable protection for a real visitor once the flag is flipped on.
export function isRedactionEnabled(): boolean {
  const raw = import.meta.env.VITE_ID_REDACTION;
  if (typeof raw !== 'string') return false;
  return raw.trim().toLowerCase() === 'true';
}

/** What may actually be persisted for a scanned ID number. */
export function redactForStorage(rawNumber: string): string {
  if (isRedactionEnabled()) return lastFourOf(rawNumber);

  // MVP-ONLY escape hatch: hands back the number completely unmasked. This
  // branch exists solely so early manual testing can compare parsed output
  // against the physical card while the feature is being built, and it MUST
  // NEVER execute against a real visitor's document. Flipping
  // VITE_ID_REDACTION=true (the required state before any real scan) removes
  // this branch from the code path entirely.
  return rawNumber;
}
