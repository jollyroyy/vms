// S7 / FR-VIS-02 (blacklist) + FR-VIS-03 (repeat-visitor recall).
// Both features key off a canonical phone string produced by normalizePhone.

export type BlacklistEntry = {
  phone: string;
  reason: string;
};

// Strip formatting, remove Indian country code (+91) or leading 0, then validate.
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');

  // Strip +91 country code (results in 12 digits → 10)
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }

  // Strip leading trunk zero (11 digits → 10)
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length < 7) {
    throw new Error('Invalid phone number format.');
  }

  return digits;
}

// Returns the blacklist entry for the given phone, or null if not found.
export function isBlacklisted(phone: string, list: BlacklistEntry[]): BlacklistEntry | null {
  const normalized = normalizePhone(phone);
  return list.find((e) => e.phone === normalized) ?? null;
}
