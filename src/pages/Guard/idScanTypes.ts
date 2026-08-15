// The result of scanning a visitor's government ID. Lives in its own file so
// plain .ts modules (checkInRecurring) can import it — see checkInTypes.ts for
// why a .ts file must never import a .tsx module under `tsc --noEmit`.
//
// `masked` and `dateOfBirth` are DISPLAY-ONLY and optional. They exist because
// the overlay's review dialog showed the guard what it had read off the card —
// document, number, name, date of birth — and then threw all but the last four
// digits away the moment "Use Details" was pressed, leaving a one-line chip
// behind. The guard is checking a card in their hand against a record; they
// need to keep seeing what was read. Only `idType` and `idLast4` are ever
// WRITTEN (visitors.id_type / id_last4) — the full number is never stored, so
// `masked` must stay masked and must never be widened into the raw value.
export type IdScanResult = {
  idType: string;
  idLast4: string;
  name: string | null;
  /** e.g. "XXXXX234F". Display only — never persisted. */
  masked?: string;
  /** As printed on the document. Display only — never persisted. */
  dateOfBirth?: string | null;
};
