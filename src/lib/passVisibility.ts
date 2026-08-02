// Which visits still have an entry pass worth showing.
//
// Previously the pass was gated on `status === 'approved'` alone, so the whole
// block — View Pass button and both download actions — vanished the moment a
// guard checked the visitor in. That is exactly when someone is most likely to
// need it again: a badge that was lost, smudged or never printed.
//
// A direct lookup rather than an includes() chain, so adding a VisitStatus is
// a compile error here until someone decides what it means for the pass.
import type { UserRole, VisitStatus } from '../types/index';

const PASS_AVAILABLE: Record<VisitStatus, boolean> = {
  // Nothing has been granted yet — there is no pass to hand over.
  pending_approval: false,
  approved: true,
  // A walk-in is already at the gate when the HOD decides, so the QR is of
  // little use — but the printed badge still is, and reprinting it is the
  // whole reason this stays visible.
  walkin_approved: true,
  // Inside the building: the QR will no longer scan (evaluateQrVisit rejects
  // it), but the pass is still the badge they are wearing. PreApprovalPass
  // says so rather than pretending the code is live.
  checked_in: true,
  // The visit is over. Reissuing a pass for it would be issuing entry to a
  // visit that has already ended.
  checked_out: false,
  rejected: false,
  cancelled: false,
  no_show: false,
};

/** True when this visit should still offer its entry pass. */
export function canShowPass(status: VisitStatus): boolean {
  return PASS_AVAILABLE[status];
}

/** True when this role may be shown an entry pass at all.
 *
 *  Guards never may. A pass a guard can open, print or download is a pass that
 *  can be issued without the visitor ever being at the gate, which is the one
 *  thing the pass is supposed to prove. Reprinting a lost badge is deliberately
 *  given up for that: it goes back to whoever raised the pre-approval.
 *
 *  Fails closed — an unknown or not-yet-loaded role is treated as a guard, so a
 *  caller that forgets to pass a role hides the pass rather than leaking it.
 */
export function canRoleShowPass(role: UserRole | null | undefined): boolean {
  return role != null && role !== 'guard';
}

// DELIBERATE GAP — do not "fix" without asking.
//
// The kiosk is exempt. /kiosk is in ROLE_ROUTES.guard, and its badge screen
// (Kiosk.tsx -> KioskBadgeScreen -> components/Badge) renders a live QR from
// visit.qr_token without consulting this module. So a signed-in guard standing
// at the kiosk can key in a pre-approved visitor's phone number and print that
// visitor's pass.
//
// That is known and accepted: the kiosk is a visitor-operated terminal and the
// badge screen is how a walk-in receives their own pass after self-check-in.
// Gating it on role would break self-service check-in, which is the entire
// point of the screen. Closing it properly needs the kiosk to stop being a
// guard route — its own role or an unauthenticated mode — not a role check
// bolted onto Badge.
