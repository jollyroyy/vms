import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import { istDateKey } from '../../lib/visitExpiry';
import { segmentFromSlug, visitorLoadFilter } from '../../lib/visitorSegments';
import VisitorSegmentContent from './VisitorSegmentContent';
import VisitorCheckInFlow from './VisitorCheckInFlow';
import VisitorKpiRail from './VisitorKpiRail';
import CardReturnConfirm from './CardReturnConfirm';
import { type WalkInCheckIn } from './GuardWalkInApproved';
import { uploadPhoto } from '../../lib/photoUpload';
import { isAlreadyInsideError } from '../../lib/activeVisit';
import { notifyHostOnCheckIn } from '../../lib/notifyHostCheckIn';
// No Badge import: the guard console must never render an entry pass. See
// canRoleShowPass in lib/passVisibility.ts for why. Badge draws a live QR
// straight from visit.qr_token and has no role gate of its own, so wiring it
// back in here would reintroduce the leak that gate exists to close.

// The Visitors surface. One page, one fetch, one realtime subscription — and a
// segment picked off the URL (`/visitors`, `/visitors/expected`, …) deciding
// which slice of it renders. The segments themselves live in
// lib/visitorSegments.ts, shared with the sidebar, so the nav and the page can
// never disagree about what exists or about what counts as "Expected".
//
// This replaced a three-tab bar buried inside the page. The tabs were invisible
// from the nav, unbookmarkable and unreachable by the back button; the sidebar
// said "Walk-in Visitors" and gave no hint that Inside or Pending existed. Old
// `?tab=` links still land somewhere live — segmentFromSlug maps every legacy
// value onto a real segment rather than 404-ing into a blank page.
export default function GuardConsole(): React.ReactElement {
  const { segment: slug } = useParams();
  const segment = segmentFromSlug(slug);

  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  // The IST date, not the UTC one. Between 00:00 and 05:30 IST
  // `toISOString().slice(0,10)` is still yesterday, which filed a visit booked
  // for 01:00 under the previous day and made it invisible on the morning it
  // was due. See lib/visitExpiry.
  const [today] = useState(() => istDateKey(new Date()));
  const [successMsg, setSuccessMsg] = useState('');
  /** The visit the last check-out closed, while it is still reversible. */
  const [undoTarget, setUndoTarget] = useState<Visit | null>(null);
  const [actionErr, setActionErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  /** The expected visitor being checked in, if the flow is open. */
  const [checkingIn, setCheckingIn] = useState<Visit | null>(null);
  /** The inside visitor whose check-out is waiting on the card-return gate. */
  const [exitTarget, setExitTarget] = useState<Visit | null>(null);

  // Today's visits PLUS every visit still open, whatever day it was raised on.
  //
  // The open statuses are never date-bounded: a walk-in registered at 23:50 and
  // approved at 00:05 would otherwise be approved into an empty list, a visitor
  // still inside from the previous evening could not be checked out, and a
  // pre-approval booked last week for today would never appear. The filter is
  // shared with the sidebar count hook (visitorLoadFilter) so the badge and the
  // list are computed from the same window.
  const loadVisits = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .or(visitorLoadFilter(today))
      .order('created_at', { ascending: false });
    if (error) { console.error('[Console] loadVisits error:', error.message); }
    let rows = ((data as unknown as Visit[]) ?? []);
    rows = await attachHostNames(rows);
    setVisits(rows.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    if (!silent) setLoading(false);
  }, [today]);

  useEffect(() => {
    void loadVisits();
    const channel = supabase
      .channel('guard-visits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void loadVisits(true); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadVisits]);

  // Leaving a segment must not strand the guard inside a half-finished check-in
  // for a visitor the new segment does not even list.
  useEffect(() => { setCheckingIn(null); }, [segment]);

  // The check-out WRITE. It is reached only through the card-return confirm
  // (CardReturnConfirm) — the dialog shows the card number the guard must
  // collect and its confirm button stays disabled until the card is ticked
  // back, so `cardReturned` here is the record of a witnessed handover.
  const logExit = async (visit: Visit) => {
    if (visit.status !== 'checked_in') { setActionErr('Visitor is not checked in.'); return; }
    setActionErr('');
    try {
      const now = new Date().toISOString();
      // A card is returned only when one was issued. `visitor_card_returned_at`
      // is the "did the card come back" answer (migration 076), distinct from
      // checked_out_at, which says the visitor left.
      const { error } = await supabase.from('visits')
        .update({
          status: 'checked_out',
          checked_out_at: now,
          exit_verified: true,
          visitor_card_returned_at: visit.visitor_card_number ? now : null,
        })
        .eq('id', visit.id);
      if (error) { setActionErr(safeErrorMessage(error, 'Failed to log exit.')); return; }
      setExitTarget(null);
      setSuccessMsg(`"${visit.visitor?.full_name ?? 'Visitor'}" checked out.`);
      // The banner stays until dismissed rather than vanishing after 4s, because
      // it now carries the only route to Undo. A mis-clicked check-out is noticed
      // within seconds — the visitor is standing there — and before this there
      // was no way back at all: the visit closes, and migration 060 then lets a
      // re-check-in create a SECOND row for one continuous presence.
      setUndoTarget(visit);
      void loadVisits(true);
    } catch (err) { setActionErr(safeErrorMessage(err, 'Failed to log exit.')); }
  };

  // Reverses the check-out just logged. The 15-minute limit is enforced in the
  // database (migration 074), not here — this button simply disappears with the
  // banner, and a stale attempt comes back as the trigger's own message.
  // `visitor_card_returned_at` is cleared too: the card is no longer "returned"
  // when its visitor is back inside (076's consistency CHECK says a returned
  // card belongs to a closed visit).
  const undoExit = async (visit: Visit) => {
    setActionErr('');
    try {
      const { error, data: updated } = await supabase.from('visits')
        .update({ status: 'checked_in', checked_out_at: null, exit_verified: null, visitor_card_returned_at: null })
        .eq('id', visit.id)
        .select('id, host_id')
        .maybeSingle();
      if (error) { setActionErr(safeErrorMessage(error, 'Could not undo the check-out.')); return; }
      if (updated) void notifyHostOnCheckIn({ id: updated.id, host_id: (updated as { host_id: string | null }).host_id, visitor_name: visit.visitor?.full_name ?? undefined });
      setSuccessMsg(`"${visit.visitor?.full_name ?? 'Visitor'}" is back on the inside list.`);
      setUndoTarget(null);
      void loadVisits(true);
    } catch (err) { setActionErr(safeErrorMessage(err, 'Could not undo the check-out.')); }
  };

  // Check-in for a walk-in the host has approved. The visit row already exists
  // (WalkInRequest created it), so this is an update, not an insert — and the
  // photo is captured now rather than at registration, because at registration
  // nobody knew yet whether this visitor was coming in.
  const checkInWalkIn = async (visit: Visit, details: WalkInCheckIn) => {
    setActionErr(''); setBusyId(visit.id);
    try {
      const { photoPath, photoData } = await uploadPhoto(details.photoBlob);
      const remarks = details.remarks.trim();
      // The ID read at the gate belongs on the visitor row, the same way
      // checkInScannedVisit persists it for the pre-approved lane — one
      // identity record whatever the arrival route.
      if (details.idScan?.idType || details.idScan?.idLast4) {
        await supabase.from('visitors').update({
          id_type: details.idScan.idType || null,
          id_last4: details.idScan.idLast4 || null,
        }).eq('id', visit.visitor_id);
      }
      const { error, data: updated } = await supabase.from('visits').update({
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
        carrying_material: details.carrying,
        carrying_remarks: details.carrying && remarks ? remarks : null,
        visitor_card_number: details.cardNumber.trim(),
        ...(photoData ? { photo_data: photoData } : {}),
        ...(photoPath ? { photo_path: photoPath } : {}),
      } as never).eq('id', visit.id).select('id, host_id').maybeSingle();
      if (error) throw error;
      if (updated) void notifyHostOnCheckIn({ id: updated.id, host_id: (updated as { host_id: string | null }).host_id, visitor_name: visit.visitor?.full_name ?? undefined });
      onCheckInSuccess(visit.visitor?.full_name ?? 'Visitor');
    } catch (err) {
      // The one-open-visit-per-visitor index (migration 060) is matched by
      // constraint NAME, so an unrelated unique violation is not mislabelled.
      setActionErr(isAlreadyInsideError(err)
        ? 'That visitor is already checked in and has not been checked out.'
        : safeErrorMessage(err, 'Check-in failed.'));
    } finally {
      setBusyId(null);
    }
  };

  const onCheckInSuccess = useCallback((name: string) => {
    setSuccessMsg(`"${name}" checked in successfully.`);
    setCheckingIn(null);
    void loadVisits(true);
    setTimeout(() => setSuccessMsg(''), 6000);
  }, [loadVisits]);

  // The check-in flow takes the whole page: a guard mid-capture is doing one
  // thing, and a list of other visitors underneath is a distraction they can
  // mis-tap.
  if (checkingIn) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in pb-4">
        <VisitorCheckInFlow
          visit={checkingIn}
          onDone={onCheckInSuccess}
          onCancel={() => setCheckingIn(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in pb-4">
      {successMsg && (
        <div className="alert-success">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1 font-semibold">{successMsg}</span>
          {undoTarget && (
            <button
              type="button"
              onClick={() => void undoExit(undoTarget)}
              className="text-xs font-bold underline underline-offset-2 hover:opacity-80"
            >
              Undo check-out
            </button>
          )}
          <button onClick={() => { setSuccessMsg(''); setUndoTarget(null); }} className="text-xs font-bold opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}
      {actionErr && (
        <div className="alert-error">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span className="flex-1 font-semibold">{actionErr}</span>
          <button onClick={() => setActionErr('')} className="text-xs font-bold opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* The KPI board sits ON TOP of the list, full width, in the same shape
          as the guard dashboard's (client instruction, 2026-08-13). It used to
          be a 300px column on the right holding square compact tiles; same
          cards, two sizes, two places. A filter must never render below the
          content it filters — that was true of the old phone layout too, which
          is why the rail was ordered first there. */}
      <VisitorKpiRail segment={segment} visits={visits} loading={loading} />

      <div className="min-w-0">
        <VisitorSegmentContent
          segment={segment}
          visits={visits}
          loading={loading}
          busyId={busyId}
          onCheckIn={setCheckingIn}
          onCheckOut={(v) => setExitTarget(v)}
          onWalkInCheckIn={(v, details) => { void checkInWalkIn(v, details); }}
          onWalkInSubmitted={onCheckInSuccess}
        />
      </div>

      {/* Every check-out passes through the card-return gate: the guard is
          shown the card number to collect and the confirm stays disabled until
          the card is ticked back (no card on record = nothing to collect). */}
      {exitTarget && (
        <CardReturnConfirm
          visit={exitTarget}
          onConfirm={() => { void logExit(exitTarget); }}
          onClose={() => setExitTarget(null)}
        />
      )}
    </div>
  );
}
