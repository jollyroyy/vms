import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit, VisitStatus } from '../../types/index';
import { safeErrorMessage } from '../../lib/errors';
import { attachHostNames } from '../../lib/hostNames';
import { attachVisitActors } from '../../lib/visitActors';
import { buildMatchItems, type PreApprovedVisit, type RecurringWithDept } from './checkInMatches';
import { useDepartments } from '../../lib/useDepartments';
import { isVisitExpired, istDayStart } from '../../lib/visitExpiry';
import { isAlreadyInsideError, ALREADY_INSIDE_FALLBACK } from '../../lib/activeVisit';
import CheckInPhotoStep from './CheckInPhotoStep';
import CheckInMatchList from './CheckInMatchList';
import CheckInScanGate from './CheckInScanGate';
import { visitToMatchItem } from './qrMatchItem';
import { checkInScannedVisit } from '../../lib/checkInFlow';
import { checkInRecurringVisitor } from '../../lib/checkInRecurring';
import { useVisitHistorySearch } from '../../lib/useVisitHistorySearch';
import type { IdScanResult } from './IdScanOverlay';
import { type MatchItem, type MatchSource, type ApprovalType } from './checkInTypes';

export type { MatchItem, ApprovalType } from './checkInTypes';

type Props = {
  today: string;
  onCheckInSuccess: (name: string) => void;
};

export default function CheckInPanel({ today, onCheckInSuccess }: Props): React.ReactElement {
  const { departments } = useDepartments();
  const [preApproved, setPreApproved] = useState<PreApprovedVisit[]>([]);
  const [recurringToday, setRecurringToday] = useState<RecurringWithDept[]>([]);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedMatch, setSelectedMatch] = useState<MatchItem | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [idScan, setIdScan] = useState<IdScanResult | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [carrying, setCarrying] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    // IST midnight. `${today}T00:00:00Z` is 05:30 IST, so a visitor checked in
    // before dawn was absent from the already-inside set this panel checks
    // against — the one guard that stops a second visit row being opened for
    // somebody who never left.
    const todayStart = istDayStart().toISOString();

    const [preRes, recurringRes, checkedRes] = await Promise.all([
      // No date bound on the fetch. Filtering on `created_at` being today meant
      // the ordinary case — booked yesterday, arriving today — never appeared in
      // this list at all. Rather than swap one date column for another, fetch the
      // open approvals and let lib/visitExpiry decide which are due: that is the
      // same predicate the nightly sweep uses, so the list and the sweep cannot
      // disagree about what is still good. The set stays small precisely because
      // the sweep closes stale rows every night (migration 066).
      supabase
        .from('visits')
        .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
        .in('status', ['approved', 'walkin_approved'])
        .order('created_at', { ascending: true }),
      supabase
        .from('recurring_visits')
        .select(`*, department:departments(id, name, code, created_at)`)
        .eq('is_active', true),
      supabase
        .from('visits')
        .select('id, visitor_id, status')
        .in('status', ['checked_in', 'checked_out'])
        .gte('created_at', todayStart),
    ]);

    // NOT filtered to today. It used to be `.filter(isDueToday)`, which decided
    // what was SEARCHABLE, not merely what was listed: with every open
    // pre-approval booked for a later day, the candidate list was empty and the
    // guard's search box returned "No match found" for a visitor whose pass was
    // sitting right there in the database. Which rows are *listed* by default
    // and which are *findable* are two different questions — buildMatchItems
    // answers them separately now.
    let rows = ((preRes.data as unknown as Visit[]) ?? []);
    rows = await attachHostNames(rows);
    const rowsWithActors = await attachVisitActors(rows);
    setPreApproved(rowsWithActors.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));

    let recurringRows = (recurringRes.data ?? []) as RecurringWithDept[];
    recurringRows = await attachHostNames(recurringRows);
    const todayDate = new Date(today);
    const dayOfWeek = todayDate.getDay();
    const dayOfMonth = todayDate.getDate();
    const filteredRecurring = recurringRows.filter((r) => {
      if (!r.is_active) return false;
      if (r.end_date && new Date(r.end_date) < todayDate) return false;
      if (new Date(r.start_date) > todayDate) return false;
      if (r.recurrence_type === 'daily') return true;
      if (r.recurrence_type === 'weekly') return r.recurrence_day === dayOfWeek;
      if (r.recurrence_type === 'monthly') return r.recurrence_day === dayOfMonth;
      return false;
    });
    setRecurringToday(filteredRecurring);

    const checkedIds = new Set<string>();
    const checkedRows = (checkedRes.data ?? []) as { id: string; visitor_id: string; status: string }[];
    checkedRows.forEach((v) => checkedIds.add(v.visitor_id));
    setCheckedInIds(checkedIds);

    setLoading(false);
  }, [today]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Both write paths persist the scanned ID themselves now — checkInFlow.ts for
  // the pre-approved/walk-in branch, checkInRecurring.ts for the recurring one —
  // so the panel no longer owns a copy of that update.
  const performCheckIn = async () => {
    if (!selectedMatch || !photoBlob) return;
    setCheckingIn(true); setError('');
    try {
      if (selectedMatch.source === 'recurring') {
        // A recurring visitor has no visit row to update, so this path creates
        // both visitor and visit — a genuinely different write, kept in its own
        // module (lib/checkInRecurring.ts) rather than inlined here.
        const outcome = await checkInRecurringVisitor({
          match: selectedMatch, photoBlob, carrying, remarks, idScan, cardNumber,
        });
        if (!outcome.ok) { setError(outcome.message); return; }
      } else {
        // Everything a QR scan can resolve — pre-approved or walk-in approved —
        // checks in through the shared mutation in lib/checkInFlow.ts, the same
        // one the Scan Pass camera lane uses. One write path, two surfaces.
        const visit = preApproved.find((v) => v.id === selectedMatch.visitId) ?? null;
        const outcome = await checkInScannedVisit({
          match: selectedMatch, visit, photoBlob, carrying, remarks, idScan, cardNumber,
        });
        if (!outcome.ok) { setError(outcome.message); return; }
      }
      setPhotoBlob(null); setSelectedMatch(null); setCardNumber(''); setCarrying(false); setRemarks('');
      onCheckInSuccess(selectedMatch.visitorName);
      void loadData();
    } catch (err) {
      // Unplanned failures only — the already-inside race is mapped to its
      // named message inside checkInScannedVisit.
      setError(isAlreadyInsideError(err)
        ? ALREADY_INSIDE_FALLBACK
        : safeErrorMessage(err, 'Check-in failed.'));
    }
    finally { setCheckingIn(false); }
  };

  // A scanned QR that passed its gate goes straight to the photo step — the
  // whole point of the scan is to skip the manual search. Host names are not
  // part of the QR lookup, so attach them here the same way loadData does.
  const handleQrResolved = useCallback(async (visit: Visit) => {
    const [withHost] = await attachHostNames([visit]);
    setSelectedMatch(visitToMatchItem(withHost ?? visit));
    setPhotoBlob(null);
    setCardNumber('');
    setCarrying(false);
    setRemarks('');
    setError('');
  }, []);

  // Expiry is end-of-day, never a countdown from the slot. This used to be
  // "more than 30 minutes past scheduled_for", which turned away a visitor stuck
  // in traffic — the pass died mid-morning while they were on their way, and the
  // guard had no way to revive it. Migration 061 removed that rule from the
  // database; this is the client finally agreeing with it. See lib/visitExpiry.
  const isExpired = useCallback((v: Visit): boolean => isVisitExpired(v), []);

  const localMatches = useMemo(
    () => buildMatchItems(preApproved, recurringToday, { search, deptFilter }),
    [preApproved, recurringToday, search, deptFilter],
  );

  // The panel's own fetch is open-statuses-only, so it can never surface a pass
  // that was already used, rejected or swept closed. useVisitHistorySearch asks
  // the server for those when — and only when — the guard actually types.
  const localVisitIds = useMemo(
    () => new Set(preApproved.map((v) => v.id)),
    [preApproved],
  );
  const { historyMatches } = useVisitHistorySearch(search, localVisitIds);

  const allMatches = useMemo(() => {
    const extra = deptFilter
      ? historyMatches.filter((m) => m.departmentId === deptFilter)
      : historyMatches;
    // Actionable rows first — a guard scanning the list should reach the pass
    // they can act on without reading past a month of closed ones.
    return [...localMatches, ...extra];
  }, [localMatches, historyMatches, deptFilter]);

  if (selectedMatch) {
    return (
      <CheckInPhotoStep
        selectedMatch={selectedMatch}
        photoBlob={photoBlob}
        error={error}
        checkingIn={checkingIn}
        carrying={carrying}
        onCarryingChange={setCarrying}
        remarks={remarks}
        onRemarksChange={setRemarks}
        cardNumber={cardNumber}
        onCardNumberChange={setCardNumber}
        onBack={() => { setSelectedMatch(null); setError(''); }}
        onCapture={(blob) => setPhotoBlob(blob)}
        onRetake={() => setPhotoBlob(null)}
        onCancel={() => { setSelectedMatch(null); setPhotoBlob(null); setIdScan(null); setCardNumber(''); setCarrying(false); setRemarks(''); }}
        onConfirm={performCheckIn}
        onScanResult={setIdScan}
      />
    );
  }

  return (
    <div className="space-y-4">
      <CheckInScanGate onResolved={handleQrResolved} />
      <CheckInMatchList
        error={error}
        search={search}
        onSearchChange={setSearch}
        deptFilter={deptFilter}
        onDeptFilterChange={setDeptFilter}
        departments={departments}
        loading={loading}
        allMatches={allMatches}
        preApproved={preApproved}
        checkedInIds={checkedInIds}
        isExpired={isExpired}
        onSelectMatch={(m) => { setSelectedMatch(m); setPhotoBlob(null); setIdScan(null); setCardNumber(''); setCarrying(false); setRemarks(''); setError(''); }}
      />
    </div>
  );
}
