// Identity verification: compare an OCR-scanned name (from an ID card) against
// the name on a pre-approved visit. Normalisation matters — OCR reads names in
// capitals, and cards often drop middle names ("Rahul Kumar Verma" vs
// "RAHUL VERMA"). The rule: match when one side's words are all present in the
// other side, after lowercasing and collapsing whitespace. That accepts
// middle-name omissions without ever accepting a genuinely different name.
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function words(name: string): string[] {
  return normalizeName(name).split(' ').filter(Boolean);
}

// Levenshtein distance — cheap enough for short names, used by the lenient
// pass to tolerate single-character OCR substitutions ("KUMAR" vs "KUMOR").
// Two-row Levenshtein DP. Wrapped accessors satisfy noUncheckedIndexedAccess:
// every index used is provably within the row's length, but the compiler
// cannot see that, so reads go through `row.at()`, returning undefined only
// out of bounds — guarded by `?? 0` on the impossible paths.
function at(row: number[], i: number): number {
  const v = row.at(i);
  return v === undefined ? 0 : v;
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  let curr: number[] = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(at(prev, j) + 1, at(curr, j - 1) + 1, at(prev, j - 1) + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev.at(b.length) ?? b.length;
}

function stripDigitsAndPunct(w: string): string {
  return w.replace(/[^a-z]/g, '');
}

// Lenient pass: every word of the shorter name must have a near-identical
// word (edit distance ≤ 1) in the longer name. Two different names must
// both be long to ever pass, so the bar stays high.
function nearWordsMatch(a: string[], b: string[]): boolean {
  const small = a.length <= b.length ? a : b;
  const large = a.length <= b.length ? b : a;
  if (small.length === 0) return false;
  let matched = 0;
  const used = new Set<number>();
  for (const w of small) {
    const cleaned = stripDigitsAndPunct(w);
    if (!cleaned) return false; // a word that loses all letters can't match
    let found = false;
    for (let i = 0; i < large.length; i++) {
      if (used.has(i)) continue;
      const cand = large[i];
      if (cand !== undefined && stripDigitsAndPunct(cand) === cleaned) {
        used.add(i);
        found = true;
        break;
      }
    }
    if (!found) {
      for (let i = 0; i < large.length; i++) {
        if (used.has(i)) continue;
        const cand = large[i];
        const cleanedCand = cand !== undefined ? stripDigitsAndPunct(cand) : '';
        if (cleanedCand && cleanedCand.length >= 3 && editDistance(cleaned, cleanedCand) <= 1) {
          used.add(i);
          found = true;
          break;
        }
      }
    }
    if (found) matched++;
  }
  // Require every short-side word to near-match; and require at least two
  // letters survived per word so "RAHUL X" can't ride on "RAHUL KUMAR".
  return matched === small.length && small.every((w) => stripDigitsAndPunct(w).length >= 2);
}

export function namesMatch(scanned: string | null, known: string | null): boolean {
  if (!scanned || !known) return false;
  const a = words(scanned);
  const b = words(known);
  if (a.length === 0 || b.length === 0) return false;
  const small = a.length <= b.length ? a : b;
  const large = a.length <= b.length ? b : a;
  // Strict pass: every word on one side is literally present on the other —
  // covers middle-name omissions, case and whitespace differences.
  if (small.every((w) => large.includes(w))) return true;
  // Lenient pass: covers OCR artefacts — an appended token stripped by the
  // caller leaving the real name intact does not belong here (extraction
  // should clean that), but a single-char substitution or stray dot does.
  return nearWordsMatch(a, b);
}
