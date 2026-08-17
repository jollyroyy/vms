// Display-side redaction helpers. Nothing here is a security boundary — the
// database already stores only `id_last4`, never a full ID number (NFR-05 /
// Aadhaar Act). These functions decide how much of what *is* stored may be
// shown, and they are the single source of truth for that decision: the
// reports register, the entry pass, the printed badge and the guard's scan
// result all render ID proof through `maskIdProof`, so the redaction rule can
// never drift between screens.

/** Renders an ID proof as `"<type> ••••<last 2>"`, or `'—'` when nothing is on record. */
export function maskIdProof(
  idType: string | null | undefined,
  idLast4: string | null | undefined,
): string {
  return idProof(idType, idLast4, '•', '—');
}

export function maskPhone(phone: string | null | undefined): string {
  return phoneMask(phone, '•', '—');
}

// ---------------------------------------------------------------------------
// THE EXPORT VARIANTS ARE ASCII, AND THAT IS NOT A STYLE CHOICE. A CSV is
// opened in Excel, which guesses the encoding per locale — a bullet (U+2022)
// and an em dash come back as "â€¢â€¢â€¢â€¢â€¢â€¢0302" and "â€”" on a
// Windows-1252 default. `exportToCsv` writes a UTF-8 BOM now, which fixes the
// visitor NAMES it cannot control, but the redaction fill is ours to pick and
// there is no reason for it to be a character that can garble at all. The
// redaction RULE does not change with the fill: the same digits are kept and
// the same digits are hidden, so a masked value in the file and the same value
// on screen still say exactly as much as each other.
// ---------------------------------------------------------------------------

/** `"<type> XXXX<last 2>"` for a downloaded file. `'Not recorded'` when there
 *  is nothing to mask — never a bare blank, which reads as a column the export
 *  forgot rather than a fact the system does not hold. */
export function maskIdProofForExport(
  idType: string | null | undefined,
  idLast4: string | null | undefined,
): string {
  return idProof(idType, idLast4, 'X', 'Not recorded');
}

/** `"XXXXXX3210"` for a downloaded file. See `maskIdProofForExport`. */
export function maskPhoneForExport(phone: string | null | undefined): string {
  return phoneMask(phone, 'X', 'Not recorded');
}

function idProof(
  idType: string | null | undefined,
  idLast4: string | null | undefined,
  fill: string,
  none: string,
): string {
  const digits = idLast4?.replace(/[^A-Za-z0-9]/g, '') ?? '';
  if (!digits) return none;
  return `${idType || 'ID'} ${fill.repeat(4)}${digits.slice(-2)}`;
}

function phoneMask(phone: string | null | undefined, fill: string, none: string): string {
  if (!phone) return none;
  if (phone.length < 4) return fill.repeat(4);
  return phone.slice(0, -4).replace(/\d/g, fill) + phone.slice(-4);
}

export function maskName(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0) + '•••';
  return parts[0]!.charAt(0) + '••• ' + parts.slice(1).map((p) => p.charAt(0) + '•••').join(' ');
}
