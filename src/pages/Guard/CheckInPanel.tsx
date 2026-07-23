import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Department, Profile, Visit, RecurringVisit } from '../../types/index';
import { normalizePhone } from '../../lib/blacklist';
import { safeErrorMessage } from '../../lib/errors';
import { attachHostNames } from '../../lib/hostNames';
import { formatTime } from '../../lib/formatDate';
import { maskPhone } from '../../lib/pii';
import PhotoCapture from '../../components/PhotoCapture';
import WalkInRequest from './WalkInRequest';

type MatchSource = 'pre_approved' | 'recurring';

interface MatchItem {
  id: string;
  source: MatchSource;
  visitorName: string;
  visitorPhone: string;
  company: string | null;
  departmentName: string;
  purpose: string;
  hostName: string;
  refNumber: string;
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
      const { photoPath, photoData } = await uploadPhoto(photoBlob);
      if (selectedMatch.source === 'recurring') {
        let normalized: string;
        try { normalized = normalizePhone(selectedMatch.visitorPhone); } catch { throw new Error('Invalid phone'); }
        const { data: vis, error: visErr } = await supabase.from('visitors').upsert(
          { phone: normalized, full_name: selectedMatch.visitorName, company: selectedMatch.company },
          { onConflict: 'phone' },
        ).select().single();
        if (visErr || !vis) throw visErr ?? new Error('Failed to create visitor');
        const { error: visitErr } = await supabase.from('visits').insert({
          visitor_id: vis.id,
          department_id: selectedMatch.id.split(':')[0],
          host_id: selectedMatch.id.split(':')[1] || vis.id,
          purpose: (selectedMatch.purpose as any) || 'other',
          photo_path: photoPath, photo_data: photoData,
          status: 'checked_in',
          checked_in_at: new Date().toISOString(),
          carrying_material: false,
          expected_duration_minutes: 60,
        });
        if (visitErr) throw visitErr;
      } else {
        const updateData: Record<string, any> = { status: 'checked_in', checked_in_at: new Date().toISOString() };
        if (photoData) updateData.photo_data = photoData;
        if (photoPath) updateData.photo_path = photoPath;
        const { error: err } = await supabase.from('visits').update(updateData).eq('id', selectedMatch.visitId);
        if (err) throw err;
      }
      setPhotoBlob(null); setSelectedMatch(null);
      onCheckInSuccess(selectedMatch.visitorName);
      void loadData();
    } catch (err) { setError(safeErrorMessage(err, 'Check-in failed.')); }
    finally { setCheckingIn(false); }
  };

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
        company: v.visitor?.company ?? null,
        departmentName: v.department?.name ?? '',
        purpose: v.purpose,
        hostName: v.host?.full_name ?? '',
        refNumber: v.ref_number,
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
        company: r.visitor_company ?? null,
        departmentName: r.department?.name ?? '',
        purpose: r.purpose,
        hostName: '',
        refNumber: '',
      });
    });

    return items;
  }, [preApproved, recurringToday, search, deptFilter]);

  const stats = useMemo(() => {
    const total = allMatches.length;
    const checkedIn = allMatches.filter((m) => {
      if (m.source === 'pre_approved') return checkedInIds.has(preApproved.find((v) => v.id === m.visitId)?.visitor_id ?? '');
      return false;
    }).length;
    return { total, checkedIn, pending: total - checkedIn };
  }, [allMatches, checkedInIds, preApproved]);

  const preApprovedCount = preApproved.length;
  const recurringCount = recurringToday.length;

  if (selectedMatch && photoBlob === null) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={() => { setSelectedMatch(null); setError(''); }} className="text-sm text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Back to search
        </button>

        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-success-500 to-emerald-600 flex items-center justify-center text-white shadow-glow-sm">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-lg font-bold text-navy-900">{selectedMatch.visitorName}</p>
              <p className="text-sm text-navy-400">{selectedMatch.departmentName} · {selectedMatch.purpose}</p>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                selectedMatch.source === 'pre_approved'
                  ? 'bg-success-50 text-success-700'
                  : 'bg-accent-50 text-accent-700'
              }`}>
                {selectedMatch.source === 'pre_approved' ? 'Pre-Approved' : 'Regular Visitor'}
              </span>
            </div>
          </div>

          <p className="text-sm font-semibold text-navy-700">Capture visitor photo to check in</p>
          {!photoBlob ? (
            <PhotoCapture onCapture={(blob) => setPhotoBlob(blob)} />
          ) : null}
        </div>

        {error && <div className="alert-error text-sm">{error}</div>}
      </div>
    );
  }

  if (selectedMatch && photoBlob) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <img src={URL.createObjectURL(photoBlob)} alt="" className="w-14 h-[72px] object-cover rounded-xl shadow-xs ring-2 ring-success-200" />
            <div className="flex-1">
              <p className="font-bold text-navy-900">{selectedMatch.visitorName}</p>
              <p className="text-xs text-navy-400">{selectedMatch.departmentName} · {maskPhone(selectedMatch.visitorPhone)}</p>
              <p className="text-xs text-navy-400">{selectedMatch.source === 'pre_approved' ? `Ref: ${selectedMatch.refNumber}` : 'Regular Visitor'}</p>
              <p className="text-xs text-success-600 font-semibold mt-1">Photo captured · Ready to check in</p>
            </div>
            <button onClick={() => setPhotoBlob(null)} className="btn-ghost text-danger-600 hover:text-danger-700 text-sm">Retake</button>
          </div>

          <div className="bg-success-50 rounded-xl p-4 border border-success-200">
            <p className="text-sm text-success-800 font-semibold">Check-in will be recorded at {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setSelectedMatch(null); setPhotoBlob(null); }} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button onClick={performCheckIn} disabled={checkingIn}
              className="flex-1 bg-gradient-to-r from-success-600 to-emerald-600 text-white rounded-xl px-5 py-3 text-sm font-bold hover:from-success-700 hover:to-emerald-700 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {checkingIn ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Checking in...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75" /></svg> Confirm Check-In
                </>)}
            </button>
          </div>
        </div>
        {error && <div className="alert-error text-sm">{error}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {error && (
        <div className="alert-error text-sm">{error}</div>
      )}

      {/* Expected Today stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card bg-gradient-to-b from-brand-50/60 to-transparent">
          <p className="stat-value text-brand-600">{preApprovedCount}</p>
          <p className="stat-label">Pre-Approved</p>
        </div>
        <div className="stat-card bg-gradient-to-b from-accent-50/60 to-transparent">
          <p className="stat-value text-accent-600">{recurringCount}</p>
          <p className="stat-label">Regular Today</p>
        </div>
        <div className="stat-card bg-gradient-to-b from-success-50/60 to-transparent">
          <p className="stat-value text-success-600">{stats.pending}</p>
          <p className="stat-label">Awaiting Arrival</p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" placeholder="Search by phone or name..." value={search}
            onChange={(e) => { setSearch(e.target.value); setShowWalkIn(false); }}
            className="input pl-9 w-full" autoFocus />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
          className="input w-full sm:w-48">
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4">
              <div className="flex gap-3">
                <div className="w-12 h-12 skeleton rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 skeleton w-1/2" />
                  <div className="h-3 skeleton w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : allMatches.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-navy-400 font-medium">
            {allMatches.length} visitor{allMatches.length !== 1 ? 's' : ''} expected
            {search && ` matching "${search}"`}
          </p>
          {allMatches.map((m, idx) => {
            const isRecurring = m.source === 'recurring';
            const isCheckedIn = m.source === 'pre_approved' && checkedInIds.has(preApproved.find((v) => v.id === m.visitId)?.visitor_id ?? '');
            return (
              <div key={`${m.id}-${idx}`}
                className={`card p-4 hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 cursor-pointer ${
                  isCheckedIn ? 'opacity-60' : ''
                }`}
                onClick={() => {
                  if (!isCheckedIn) { setSelectedMatch(m); setPhotoBlob(null); setError(''); }
                }}>
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                    isRecurring
                      ? 'bg-accent-50 text-accent-600'
                      : 'bg-success-50 text-success-600'
                  }`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-navy-900">{m.visitorName}</p>
                      {isRecurring && (
                        <span className="status-badge bg-accent-50 text-accent-700 border border-accent-200/60">
                          Regular
                        </span>
                      )}
                      {!isRecurring && (
                        <span className="status-badge bg-success-50 text-success-700 border border-success-200/60">
                          Pre-Approved
                        </span>
                      )}
                      {isCheckedIn && (
                        <span className="status-badge bg-brand-50 text-brand-700 border border-brand-200/60">
                          Checked In
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-navy-400 mt-0.5">
                      {m.company ? `${m.company} · ` : ''}{m.departmentName}{m.hostName ? ` · ${m.hostName}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-navy-300">
                      <span>{m.purpose}</span>
                      {m.refNumber && <><span className="text-navy-200">·</span><span className="font-mono">{m.refNumber}</span></>}
                    </div>
                  </div>
                  {!isCheckedIn && (
                    <button onClick={(e) => { e.stopPropagation(); setSelectedMatch(m); setPhotoBlob(null); setError(''); }}
                      className="bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl text-xs px-4 py-2 font-semibold hover:from-brand-700 hover:to-brand-800 active:scale-[0.98] transition-all flex items-center gap-1.5 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75" /></svg>
                      Check In
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : search || deptFilter ? (
        <div className="text-center py-8 space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 mb-1">
            <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-navy-600">No matching visitor found</p>
          <p className="text-xs text-navy-400 max-w-sm mx-auto">This visitor isn't pre-approved or registered as a regular. Request walk-in approval from the HOD.</p>
          {!showWalkIn ? (
            <button onClick={() => setShowWalkIn(true)}
              className="btn-accent text-sm mt-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Request Walk-in Approval
            </button>
          ) : (
            <WalkInRequest
              onSubmitted={(name) => { onCheckInSuccess(name); setShowWalkIn(false); setSearch(''); void loadData(); }}
              onCancel={() => setShowWalkIn(false)}
            />
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100 mb-3">
            <svg className="w-6 h-6 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-navy-600">Search for a visitor to check in</p>
          <p className="text-xs text-navy-400 mt-1">Type name or phone number above</p>
        </div>
      )}
    </div>
  );
}
