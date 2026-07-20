// S3 / NFR-07 — reference number generation.
// NOTE: this module is the FORMAT logic; production generation runs server-side
// (Postgres function) so clients can never mint or edit refs (SEC-3). The same
// format rules are enforced there; these functions also back the seed script.

export type RefKind = 'VIS' | 'GP-IN' | 'GP-OUT';

const REF_PATTERN = /^(VIS|GP-IN|GP-OUT)-(\d{8})-(\d{4,})$/;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

export function formatRefNumber(kind: RefKind, date: Date, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Invalid sequence: ${seq}`);
  }
  return `${kind}-${dateKey(date)}-${String(seq).padStart(4, '0')}`;
}

export function nextSequence(lastRef: string | null, date: Date): number {
  if (lastRef === null) return 1;
  const match = REF_PATTERN.exec(lastRef);
  if (!match) {
    throw new Error(`Malformed reference number: ${lastRef}`);
  }
  const [, , lastDate, lastSeq] = match;
  if (lastDate !== dateKey(date)) return 1; // daily reset
  return Number(lastSeq) + 1;
}
