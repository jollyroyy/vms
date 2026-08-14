// What a scanned pass actually TELLS the guard.
//
// The scanner used to answer one question — may this visitor check in? — and
// threw away everything else it had just fetched. A blocked pass rendered as a
// red sentence and a name, which left the guard holding a visitor and no way to
// see who they were, who they were here to meet, or what had already happened
// to the visit. The lookup returns the whole row; this module turns it into the
// facts a guard needs, and the gate becomes one of those facts rather than the
// only one.
//
// Pure on purpose: no fetching, no component. The scan lane renders it, and a
// test can assert every branch without a camera.
import type { Visit } from '../types/index';
import type { QrGate } from './qrToken';
import { visitOrigin, visitOriginLabel, type VisitOrigin } from './visitOrigin';
import { STATUS_STYLES } from './statusStyles';
import { isDueToday } from './visitExpiry';

/**
 * Where the visitor physically is, which is NOT the same question as
 * `visits.status`.
 *
 * Status holds one value, so a visitor who came and left reads `checked_out`
 * and one who never arrived reads `no_show` — both are "not currently here",
 * but only one of them ever walked through the gate. Derived from the two
 * timestamps rather than the status, the same way useGateStats derives
 * `entered`: a row with `checked_in_at` set arrived, whatever became of it
 * afterwards. An undone check-out (migration 074) nulls `checked_out_at`, so
 * that visitor correctly reads as inside again.
 */
export type Presence = 'not_arrived' | 'inside' | 'departed';

const PRESENCE_LABEL: Record<Presence, string> = {
  not_arrived: 'Not checked in yet',
  inside: 'Already checked in — currently inside',
  departed: 'Checked out — this visit is complete',
};

export type ScanOutcome = {
  /** Which desk this visit came through — see lib/visitOrigin.ts, including
   *  why a converged status makes this inferred rather than read. */
  origin: VisitOrigin;
  originLabel: string;
  /** The visit's own status, in the same words the status badge uses
   *  everywhere else in the app. One vocabulary, learned once. */
  statusLabel: string;
  presence: Presence;
  presenceLabel: string;
  /** True only when this pass may be honoured right now. */
  canCheckIn: boolean;
  /** Why not, in words a guard can read out to the visitor. Null when
   *  `canCheckIn` is true. */
  blockedReason: string | null;
};

const NOT_DUE =
  'This pass is valid but is booked for another day, so it cannot be honoured today.';

/**
 * Everything the scan lane shows about a resolved pass.
 *
 * `gate` comes from evaluateQrVisit (expiry, then status). The extra test here
 * is `isDueToday`: the gate passes a pre-approval booked for next week — the
 * pass is perfectly valid, it is simply not due — and letting that visitor in
 * early is a different permission from seeing that their pass exists. Same rule
 * buildMatchItems applies on the search desk, so the two lanes cannot disagree.
 */
export function scanOutcome(visit: Visit, gate: QrGate, now: Date = new Date()): ScanOutcome {
  const presence: Presence = visit.checked_out_at
    ? 'departed'
    : visit.checked_in_at
      ? 'inside'
      : 'not_arrived';

  const dueToday = isDueToday(visit, now);
  const canCheckIn = gate.ok && dueToday;

  return {
    origin: visitOrigin(visit),
    originLabel: visitOriginLabel(visitOrigin(visit)),
    statusLabel: STATUS_STYLES[visit.status].label,
    presence,
    presenceLabel: PRESENCE_LABEL[presence],
    canCheckIn,
    // The gate's own reason wins when it has one: it is the more specific
    // answer ("already checked in", "expired") and the guard needs the specific
    // one to explain the refusal.
    blockedReason: canCheckIn ? null : (gate.reason ?? NOT_DUE),
  };
}
