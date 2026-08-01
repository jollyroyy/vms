import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Department, Profile, Visit, RecurringVisit, VisitorPurpose } from '../../types/index';
import { normalizePhone } from '../../lib/blacklist';
import { safeErrorMessage } from '../../lib/errors';
import { attachHostNames } from '../../lib/hostNames';
import { attachVisitActors } from '../../lib/visitActors';
import { useDepartments } from '../../lib/useDepartments';
import CheckInPhotoStep from './CheckInPhotoStep';
import CheckInMatchList from './CheckInMatchList';
import CheckInScanGate from './CheckInScanGate';
import { visitToMatchItem } from './qrMatchItem';

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
  company: string;
  approvalType: ApprovalType;
  approvedAt: string | null;
  scheduledFor: string | null;
  visitId?: string;
}

interface RecurringWithDept extends RecurringVisit {
  department?: Department;
  host?: Pick<Profile, 'id' | 'full_name'>;
}

interface PreApprovedVisit extends Visit {
  actor?: { name: string; role: string } | null;
  actorAt?: string | null;
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

  const uploadPhoto = useCallback(async (blob: Blob): Promise<{ photoPath: string | null; photoData: string | null }> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read photo'));
      reader.readAsDataURL(blob);
    });
    const filePath = `visits/${Date.now()}.webp`;
    const { error: uploadErr } = await supabase.storage
      .from('visitor-photos')
      .upload(filePath, blob, { contentType: 'image/webp', upsert: true });
    if (uploadErr) {
      return { photoPath: null, photoData: base64 };
    }
    const { data: urlData } = await supabase.storage
      .from('visitor-photos')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);
    return { photoPath: filePath, photoData: urlData?.signedUrl ?? base64 };
  }, []);

  const performCheckIn = async () => {
    if (!selectedMatch || !photoBlob) return;
    setCheckingIn(true); setError('');
    try {
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
          { phone: normalized, full_name: selectedMatch.visitorName, company: null },
          { onConflict: 'phone' },
        ).select().single();
        if (visErr || !vis) throw visErr ?? new Error('Failed to create visitor');
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
          carrying_material: false,
          scheduled_for: null,
        });
        if (visitErr) throw visitErr;
      } else {
        const visitId = selectedMatch.visitId;
        if (!visitId) throw new Error('Missing visit ID for check-in');
        const { error: err } = await supabase.from('visits').update({
          status: 'checked_in',
          checked_in_at: new Date().toISOString(),
          ...(photoData ? { photo_data: photoData } : {}),
          ...(photoPath ? { photo_path: photoPath } : {}),
        } as any).eq('id', visitId);
        if (err) throw err;
      }
      setPhotoBlob(null); setSelectedMatch(null);
      onCheckInSuccess(selectedMatch.visitorName);
      void loadData();
    } catch (err) { setError(safeErrorMessage(err, 'Check-in failed.')); }
    finally { setCheckingIn(false); }
  };

  // A scanned QR that passed its gate goes straight to the photo step — the
  // whole point of the scan is to skip the manual search. Host names are not
  // part of the QR lookup, so attach them here the same way loadData does.
  const handleQrResolved = useCallback(async (visit: Visit) => {
    const [withHost] = await attachHostNames([visit]);
    setSelectedMatch(visitToMatchItem(withHost ?? visit));
    setPhotoBlob(null);
    setError('');
  }, []);

  const isExpired = useCallback((v: Visit): boolean => {
    if (!v.scheduled_for) return false;
    const scheduled = new Date(v.scheduled_for).getTime();
    const now = Date.now();
    // Expired if scheduled time was more than 30 minutes ago
    return now - scheduled > 30 * 60 * 1000;
  }, []);

  const allMatches = useMemo(() => {
    const items: MatchItem[] = [];
    const q = search.toLowerCase().trim();

    preApproved.forEach((v) => {
      const name = v.visitor?.full_name ?? '';
      const phone = v.visitor?.phone ?? '';
      if (q && !name.toLowerCase().includes(q) && !phone.includes(q)) return;
      if (deptFilter && v.department_id !== deptFilter) return;
      const isWalkin = v.status === 'walkin_approved';
      items.push({
        id: `pre:${v.id}`,
        source: 'pre_approved',
        visitorName: name,
        visitorPhone: phone,
        departmentName: v.department?.name ?? '',
        purpose: v.purpose,
        hostName: v.host?.full_name ?? '',
        company: v.visitor?.company ?? '',
        approvalType: isWalkin ? 'walkin_approved' : 'pre_approved',
        approvedAt: (isWalkin ? v.actorAt : null) ?? v.created_at,
        scheduledFor: v.scheduled_for,
        visitId: v.id,
      });
    });

    recurringToday.forEach((r) => {
      const name = r.visitor_name ?? '';
      const phone = r.visitor_phone ?? '';
      if (q && !name.toLowerCase().includes(q) && !phone.includes(q)) return;
      if (deptFilter && r.department_id !== deptFilter) return;
      items.push({
        id: `rec:${r.department_id}:${r.host_id}`,
        source: 'recurring',
        visitorName: name,
        visitorPhone: phone,
        departmentName: r.department?.name ?? '',
        purpose: r.purpose,
        hostName: r.host?.full_name ?? '',
        company: r.visitor_company ?? '',
        approvalType: 'recurring',
        approvedAt: null,
        scheduledFor: null,
      });
    });

    return items;
  }, [preApproved, recurringToday, search, deptFilter]);

  if (selectedMatch) {
    return (
      <CheckInPhotoStep
        selectedMatch={selectedMatch}
        photoBlob={photoBlob}
        error={error}
        checkingIn={checkingIn}
        onBack={() => { setSelectedMatch(null); setError(''); }}
        onCapture={(blob) => setPhotoBlob(blob)}
        onRetake={() => setPhotoBlob(null)}
        onCancel={() => { setSelectedMatch(null); setPhotoBlob(null); }}
        onConfirm={performCheckIn}
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
        onSelectMatch={(m) => { setSelectedMatch(m); setPhotoBlob(null); setError(''); }}
        showWalkIn={showWalkIn}
        onShowWalkIn={() => setShowWalkIn(true)}
        onWalkInSubmitted={(name) => { onCheckInSuccess(name); setShowWalkIn(false); setSearch(''); void loadData(); }}
        onWalkInCancel={() => setShowWalkIn(false)}
        />
    </div>
  );
}
