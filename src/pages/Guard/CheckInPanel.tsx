import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit, VisitorPurpose } from '../../types/index';
import { normalizePhone } from '../../lib/blacklist';
import { safeErrorMessage } from '../../lib/errors';
import { attachHostNames } from '../../lib/hostNames';
import { attachVisitActors } from '../../lib/visitActors';
import { buildMatchItems, type PreApprovedVisit, type RecurringWithDept } from './checkInMatches';
import { useDepartments } from '../../lib/useDepartments';
import { uploadPhoto } from '../../lib/photoUpload';
import {
  findActiveVisitByPhone, findActiveVisitByIdProof, activeVisitMessage,
  isAlreadyInsideError, ALREADY_INSIDE_FALLBACK,
} from '../../lib/activeVisit';
import CheckInPhotoStep from './CheckInPhotoStep';
import CheckInMatchList from './CheckInMatchList';
import CheckInScanGate from './CheckInScanGate';
import { visitToMatchItem } from './qrMatchItem';
import type { IdScanResult } from './IdScanOverlay';

type MatchSource = 'pre_approved' | 'recurring';
export type ApprovalType = 'pre_approved' | 'walkin_approved' | 'recurring';

export interface MatchItem {
  id: string;
  source: MatchSource;
  visitorName: string;
  visitorPhone: string;
  departmentName: string;
  purpose: string;
  hostName: string;
  vendorName: string;
  approvalType: ApprovalType;
  approvedAt: string | null;
  scheduledFor: string | null;
  visitId?: string;
  // Carried on the pass and shown back to the guard once it is scanned, so
  // they can check the person in front of them against the record. Absent for
  // recurring visitors, who have no visit row until they are checked in.
  photoUrl?: string | null;
  idType?: string | null;
  idLast4?: string | null;
  refNumber?: string | null;
}

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
  const [carrying, setCarrying] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const todayStart = `${today}T00:00:00Z`;
    const todayEnd = `${today}T23:59:59Z`;

    const [preRes, recurringRes, checkedRes] = await Promise.all([
      supabase
        .from('visits')
        .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
        .in('status', ['approved', 'walkin_approved'])
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
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

  const persistIdScan = useCallback(async (visitorId: string) => {
    if (!idScan?.idType && !idScan?.idLast4) return;
    await supabase.from('visitors').update({
      id_type: idScan.idType || null,
      id_last4: idScan.idLast4 || null,
    }).eq('id', visitorId);
  }, [idScan]);

  const performCheckIn = async () => {
    if (!selectedMatch || !photoBlob) return;
    setCheckingIn(true); setError('');
    try {
      // The tick box is the record. Remarks only survive if the box is ticked,
      // so a guard who types a list and then unticks cannot leave orphaned text
      // describing material the visit says was never carried.
      const remarksTrimmed = carrying ? remarks.trim() : '';

      // Nobody who is already inside may check in again — they have to check
      // out first. Migration 060 enforces this on visits(visitor_id) where
      // status = 'checked_in'; this pre-check exists to name the person instead
      // of showing the guard a raw constraint violation. The ID check is the
      // weaker of the two (only the last four digits are stored) so it runs
      // second and only when the phone came back clean.
      const clash = await findActiveVisitByPhone(selectedMatch.visitorPhone)
        ?? await findActiveVisitByIdProof(
          idScan?.idType ?? selectedMatch.idType,
          idScan?.idLast4 ?? selectedMatch.idLast4,
        );
      if (clash) {
        setError(activeVisitMessage(clash));
        setCheckingIn(false);
        return;
      }

      // Block check-in for expired pre-approved visits
      if (selectedMatch.source === 'pre_approved' && selectedMatch.visitId) {
        const visit = preApproved.find((v) => v.id === selectedMatch.visitId);
        if (visit && isExpired(visit)) {
          setError('Cannot check in — the scheduled time has passed. Please request a new approval.');
          setCheckingIn(false);
          return;
        }
      }
      const { photoPath, photoData } = await uploadPhoto(photoBlob);
      if (selectedMatch.source === 'recurring') {
        let normalized: string;
        try { normalized = normalizePhone(selectedMatch.visitorPhone); } catch { throw new Error('Invalid phone'); }
        const { data: vis, error: visErr } = await supabase.from('visitors').upsert(
          { phone: normalized, full_name: selectedMatch.visitorName, vendor_name: null },
          { onConflict: 'phone' },
        ).select().single();
        if (visErr || !vis) throw visErr ?? new Error('Failed to create visitor');
        await persistIdScan(vis.id);
        const deptId = selectedMatch.id.split(':')[0] ?? '';
        const hostParts = selectedMatch.id.split(':')[1];
        const { error: visitErr } = await supabase.from('visits').insert({
          visitor_id: vis.id,
          department_id: deptId,
          host_id: hostParts || vis.id,
          purpose: (selectedMatch.purpose as VisitorPurpose) || 'other',
          photo_path: photoPath, photo_data: photoData,
          status: 'checked_in',
          checked_in_at: new Date().toISOString(),
          checked_out_at: null, exit_verified: null, rejection_reason: null,
          carrying_material: carrying, carrying_remarks: remarksTrimmed || null,
          scheduled_for: null,
        });
        if (visitErr) throw visitErr;
      } else {
        const visitId = selectedMatch.visitId;
        if (!visitId) throw new Error('Missing visit ID for check-in');
        const { data: visitRec } = await supabase.from('visits').select('visitor_id').eq('id', visitId).maybeSingle();
        await persistIdScan((visitRec as { visitor_id: string } | null)?.visitor_id ?? '');
        const { error: err } = await supabase.from('visits').update({
          status: 'checked_in',
          checked_in_at: new Date().toISOString(),
          carrying_material: carrying, carrying_remarks: remarksTrimmed || null,
          ...(photoData ? { photo_data: photoData } : {}),
          ...(photoPath ? { photo_path: photoPath } : {}),
        } as any).eq('id', visitId);
        if (err) throw err;
      }
      setPhotoBlob(null); setSelectedMatch(null); setCarrying(false); setRemarks('');
      onCheckInSuccess(selectedMatch.visitorName);
      void loadData();
    } catch (err) {
      // The race the pre-check cannot close: a second device checked the same
      // visitor in between our lookup and our write.
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
    setCarrying(false);
    setRemarks('');
    setError('');
  }, []);

  const isExpired = useCallback((v: Visit): boolean => {
    if (!v.scheduled_for) return false;
    const scheduled = new Date(v.scheduled_for).getTime();
    const now = Date.now();
    // Expired if scheduled time was more than 30 minutes ago
    return now - scheduled > 30 * 60 * 1000;
  }, []);

  const allMatches = useMemo(
    () => buildMatchItems(preApproved, recurringToday, { search, deptFilter }),
    [preApproved, recurringToday, search, deptFilter],
  );

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
        onBack={() => { setSelectedMatch(null); setError(''); }}
        onCapture={(blob) => setPhotoBlob(blob)}
        onRetake={() => setPhotoBlob(null)}
        onCancel={() => { setSelectedMatch(null); setPhotoBlob(null); setIdScan(null); setCarrying(false); setRemarks(''); }}
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
        onSearchChange={(value) => { setSearch(value); setShowWalkIn(false); }}
        deptFilter={deptFilter}
        onDeptFilterChange={setDeptFilter}
        departments={departments}
        loading={loading}
        allMatches={allMatches}
        preApproved={preApproved}
        checkedInIds={checkedInIds}
        isExpired={isExpired}
        onSelectMatch={(m) => { setSelectedMatch(m); setPhotoBlob(null); setIdScan(null); setCarrying(false); setRemarks(''); setError(''); }}
        showWalkIn={showWalkIn}
        onShowWalkIn={() => setShowWalkIn(true)}
        onWalkInSubmitted={(name) => { onCheckInSuccess(name); setShowWalkIn(false); setSearch(''); void loadData(); }}
        onWalkInCancel={() => setShowWalkIn(false)}
        />
    </div>
  );
}
