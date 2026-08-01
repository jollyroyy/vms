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

export function namesMatch(scanned: string | null, known: string | null): boolean {
  if (!scanned || !known) return false;
  const a = words(scanned);
  const b = words(known);
  if (a.length === 0 || b.length === 0) return false;
  const small = a.length <= b.length ? a : b;
  const large = a.length <= b.length ? b : a;
  return small.every((w) => large.includes(w));
}
