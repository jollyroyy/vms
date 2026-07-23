import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Department, Profile, Visit, RecurringVisit, VisitorPurpose } from '../../types/index';
import { normalizePhone } from '../../lib/blacklist';
import { safeErrorMessage } from '../../lib/errors';
import { attachHostNames } from '../../lib/hostNames';
import PhotoCapture from '../../components/PhotoCapture';
import WalkInRequest from './WalkInRequest';

type MatchSource = 'pre_approved' | 'recurring';

interface MatchItem {
  id: string;
  source: MatchSource;
  visitorName: string;
  visitorPhone: string;
  departmentName: string;
  purpose: string;
  visitId?: string;
}

interface RecurringWithDept extends RecurringVisit {
  department?: Department;
}

type Props = {
  today: string;
  onCheckInSuccess: (name: string) => void;
};

export default function CheckInPanel({ today, onCheckInSuccess }: Props): React.ReactElement {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [preApproved, setPreApproved] = useState<Visit[]>([]);
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

  useEffect(() => {
    supabase.from('departments').select('*').order('name').then(({ data }) => setDepartments(data ?? []));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const todayStart = `${today}T00:00:00Z`;
    const todayEnd = `${today}T23:59:59Z`;

    const [preRes, recurringRes, checkedRes] = await Promise.all([
      supabase
        .from('visits')
        .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
        .eq('status', 'approved')
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
    setPreApproved(rows.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));

    const recurringRows = (recurringRes.data ?? []) as RecurringWithDept[];
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
          expected_duration_minutes: 60,
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
      items.push({
        id: `pre:${v.id}`,
        source: 'pre_approved',
        visitorName: name,
        visitorPhone: phone,
        departmentName: v.department?.name ?? '',
        purpose: v.purpose,
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
      });
    });

    return items;
  }, [preApproved, recurringToday, search, deptFilter]);

  if (selectedMatch && photoBlob === null) {
    return (
      <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
        <button onClick={() => { setSelectedMatch(null); setError(''); }} className="text-sm text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Back to search
        </button>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-surface-100 space-y-4">
          <div>
            <p className="text-xl font-bold text-navy-900">{selectedMatch.visitorName}</p>
            <p className="text-sm text-navy-400">{selectedMatch.departmentName} · {selectedMatch.purpose}</p>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
              selectedMatch.source === 'pre_approved' ? 'bg-success-50 text-success-700' : 'bg-accent-50 text-accent-700'
            }`}>
              {selectedMatch.source === 'pre_approved' ? 'Pre-Approved' : 'Regular Visitor'}
            </span>
          </div>
          <p className="text-sm font-semibold text-navy-700">Take a photo to check in</p>
          <PhotoCapture onCapture={(blob) => setPhotoBlob(blob)} />
        </div>
        {error && <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>}
      </div>
    );
  }

  if (selectedMatch && photoBlob) {
    return (
      <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-surface-100 space-y-4">
          <div className="flex items-center gap-3">
            <img src={URL.createObjectURL(photoBlob)} alt="" className="w-14 h-[72px] object-cover rounded-xl ring-2 ring-success-200" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-navy-900">{selectedMatch.visitorName}</p>
              <p className="text-sm text-navy-400 truncate">{selectedMatch.departmentName}</p>
              <p className="text-xs text-success-600 font-semibold mt-1">Photo captured</p>
            </div>
            <button onClick={() => setPhotoBlob(null)} className="text-danger-600 hover:text-danger-700 text-sm font-semibold shrink-0">Retake</button>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setSelectedMatch(null); setPhotoBlob(null); }} className="flex-1 bg-surface-50 hover:bg-surface-100 text-navy-700 font-bold rounded-xl py-3 text-sm transition-all">Cancel</button>
            <button onClick={performCheckIn} disabled={checkingIn}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl py-3 text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {checkingIn ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Checking in...</>
              ) : 'Check In'}
            </button>
          </div>
        </div>
        {error && <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {error && (
        <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-300 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" placeholder="Search by phone or name..." value={search}
            onChange={(e) => { setSearch(e.target.value); setShowWalkIn(false); }}
            className="w-full pl-12 pr-4 py-3.5 bg-surface-50 border border-surface-200 rounded-2xl text-base font-medium text-navy-900 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" autoFocus />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
          className="w-full sm:w-44 px-4 py-3.5 bg-surface-50 border border-surface-200 rounded-2xl text-sm text-navy-700 focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 skeleton rounded-2xl" />
          ))}
        </div>
      ) : allMatches.length > 0 ? (
        <div className="space-y-2">
          {allMatches.map((m, idx) => {
            const isRecurring = m.source === 'recurring';
            const isCheckedIn = m.source === 'pre_approved' && checkedInIds.has(preApproved.find((v) => v.id === m.visitId)?.visitor_id ?? '');
            const visitRecord = m.source === 'pre_approved' ? preApproved.find((v) => v.id === m.visitId) : null;
            const expired = visitRecord ? isExpired(visitRecord) : false;
            const disabled = isCheckedIn || expired;
            return (
              <div key={`${m.id}-${idx}`}
                className={`bg-white rounded-2xl p-4 shadow-sm border border-surface-100 flex items-center justify-between transition-all ${
                  disabled ? 'opacity-50' : 'hover:shadow-md cursor-pointer'
                }`}
                onClick={() => {
                  if (!disabled) { setSelectedMatch(m); setPhotoBlob(null); setError(''); }
                }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-navy-900">{m.visitorName}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isRecurring ? 'bg-accent-50 text-accent-700' : 'bg-success-50 text-success-700'
                    }`}>
                      {isRecurring ? 'Regular' : 'Pre-Approved'}
                    </span>
                    {isCheckedIn && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">Checked In</span>
                    )}
                    {expired && !isCheckedIn && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-danger-50 text-danger-700">Expired</span>
                    )}
                  </div>
                  <p className="text-sm text-navy-400 mt-0.5 truncate">{m.departmentName} · {m.purpose}</p>
                </div>
                {!disabled && (
                  <button onClick={(e) => { e.stopPropagation(); setSelectedMatch(m); setPhotoBlob(null); setError(''); }}
                    className="shrink-0 ml-3 bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">
                    Check In
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : search || deptFilter ? (
        <div className="text-center py-12 bg-surface-50 rounded-2xl space-y-3">
          <p className="text-lg font-bold text-navy-600">No match found</p>
          <p className="text-sm text-navy-400">No pre-approved or regular visitor matches your search.</p>
          {!showWalkIn ? (
            <button onClick={() => setShowWalkIn(true)}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Request Walk-in Approval
            </button>
          ) : (
            <div className="max-w-lg mx-auto">
              <WalkInRequest
                onSubmitted={(name) => { onCheckInSuccess(name); setShowWalkIn(false); setSearch(''); void loadData(); }}
                onCancel={() => setShowWalkIn(false)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 bg-surface-50 rounded-2xl">
          <svg className="w-12 h-12 mx-auto text-navy-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <p className="text-lg font-bold text-navy-600">Search for a visitor</p>
          <p className="text-sm text-navy-400 mt-1">Type name or phone number above</p>
        </div>
      )}
    </div>
  );
}
