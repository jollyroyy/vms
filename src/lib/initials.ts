// Initials for an avatar circle, in one place.
//
// Every board that renders a round face computes these, and the guard
// dashboard, the HOD board and now seven admin tabs each had their own inline
// arrow function. Nine copies of two lines is nine chances for one board to
// take three letters where the rest take two — visible immediately, since these
// sit in fixed-width circles beside each other on the same screens.

/** Up to two uppercase initials from a display name, falling back to the email
 *  local-part so an account with no name still gets a stable monogram.
 *
 *  Kept alongside `initialsOf` rather than merged into it: this one is for an
 *  ACCOUNT, where an email is always available as a fallback and the first two
 *  words are the right pick for a signed-in user's own monogram. `initialsOf`
 *  is for a VISITOR or a host read off a row, where there is no email to fall
 *  back to and the surname matters. Collapsing them would mean one of the two
 *  callers passing a dummy argument to get the other's behaviour. */
export function initialsFor(fullName: string | null | undefined, email = ''): string {
  const name = (fullName ?? '').trim();
  if (name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
  }
  return (email.split('@')[0] || 'U').slice(0, 2).toUpperCase();
}

export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  // First and LAST, not first and second: "Arjun Kumar Mehta" reads as AM to
  // anyone who knows him, and AK to nobody.
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}
