import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import { istDateKey } from '../../lib/visitExpiry';
import { segmentFromSlug, visitorLoadFilter } from '../../lib/visitorSegments';
import VisitorSegmentContent from './VisitorSegmentContent';
import VisitorKpiRail from './VisitorKpiRail';
import { checkInApprovedWalkIn, type WalkInCheckIn } from '../../lib/checkInWalkInApproved';
import { uploadPhoto } from '../../lib/photoUpload';
import { isAlreadyInsideError } from '../../lib/activeVisit';
import { notifyHostOnCheckIn } from '../../lib/notifyHostCheckIn';
// No Badge import: the guard console must never render an entry pass. See
// canRoleShowPass in lib/passVisibility.ts for why. Badge draws a live QR
// straight from visit.qr_token and has no role gate of its own, so wiring it
// back in here would reintroduce the leak that gate exists to close.
//
// There is no check-in or check-out machinery here either (client instruction,
// 2026-08-14): the Visitors tab only shows which visitor falls under which
// category. Entry is the Scan Pass and Pre-Approvals desks; exit is the Inside
// Now tab (/guard/inside-now), which owns the card-return gate and the undo
// banner. This page lists, nothing more.

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
  const [actionErr, setActionErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

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

  // The check-in WRITE for a walk-in the host has approved. The visit row
  // already exists (WalkInRequest created it), so this is an update, not an
  // insert — and the photo is captured now rather than at registration, because
  // at registration nobody knew yet whether this visitor was coming in.
  // The write itself lives in lib/checkInWalkInApproved.ts — it has two
  // callers since the walk-in lane became its own destination (/guard/walk-in),
  // and the only route from walkin_approved to checked_in must not exist twice.
  const checkInWalkIn = async (visit: Visit, details: WalkInCheckIn) => {
    setActionErr(''); setBusyId(visit.id);
    const res = await checkInApprovedWalkIn(visit, details);
    setBusyId(null);
    if (!res.ok) { setActionErr(res.message); return; }
    onCheckInSuccess(res.visitorName);
  };

  const onCheckInSuccess = useCallback((name: string) => {
    setSuccessMsg(`"${name}" checked in successfully.`);
    void loadVisits(true);
    setTimeout(() => setSuccessMsg(''), 6000);
  }, [loadVisits]);

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in pb-4">
      {successMsg && (
        <div className="alert-success">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1 font-semibold">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-xs font-bold opacity-70 hover:opacity-100">Dismiss</button>
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
          onWalkInCheckIn={(v, details) => { void checkInWalkIn(v, details); }}
          onWalkInSubmitted={onCheckInSuccess}
        />
      </div>
    </div>
  );
}
