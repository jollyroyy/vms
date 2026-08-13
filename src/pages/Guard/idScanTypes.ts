// The result of scanning a visitor's government ID. Lives in its own file so
// plain .ts modules (checkInRecurring) can import it — see checkInTypes.ts for
// why a .ts file must never import a .tsx module under `tsc --noEmit`.
export type IdScanResult = { idType: string; idLast4: string; name: string | null };