/**
 * Durable "password reset not yet completed" marker.
 *
 * A Supabase recovery link signs the user into a normal, persisted, auto-refreshing
 * session. Gating only on the one-time `type=recovery` URL hash meant that if the user
 * opened the link and then closed the tab WITHOUT submitting the form, the session
 * survived — and the next app load (no hash present) let them straight into the
 * dashboard, having never set a new password. The recovery email effectively granted
 * standing account access.
 *
 * This flag outlives the hash, so the reset screen is enforced for the lifetime of the
 * recovery session rather than only on the first render after the click.
 */
const RECOVERY_FLAG = 'sg-password-recovery-pending';

export function markRecoveryPending(): void {
  try { window.localStorage.setItem(RECOVERY_FLAG, '1'); } catch { /* storage unavailable */ }
}

export function clearRecoveryPending(): void {
  try { window.localStorage.removeItem(RECOVERY_FLAG); } catch { /* storage unavailable */ }
}

export function isRecoveryPending(): boolean {
  try { return window.localStorage.getItem(RECOVERY_FLAG) === '1'; } catch { return false; }
}

/** True when the current page load arrived via a Supabase recovery link. */
export function hasRecoveryHash(): boolean {
  try { return window.location.hash.includes('type=recovery'); } catch { return false; }
}
