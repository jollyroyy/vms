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
  const digits = idLast4?.replace(/[^A-Za-z0-9]/g, '') ?? '';
  if (!digits) return '—';
  return `${idType || 'ID'} ••••${digits.slice(-2)}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  if (phone.length < 4) return '••••';
  return phone.slice(0, -4).replace(/\d/g, '•') + phone.slice(-4);
}

export function maskName(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0) + '•••';
  return parts[0]!.charAt(0) + '••• ' + parts.slice(1).map((p) => p.charAt(0) + '•••').join(' ');
}
