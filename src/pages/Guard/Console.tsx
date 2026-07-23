import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import { formatDuration } from '../../lib/formatDate';
import CheckInPanel from './CheckInPanel';
import Badge from '../../components/Badge';

export default function GuardConsole(): React.ReactElement {
  const [mode, setMode] = useState<'checkin' | 'exit'>('checkin');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [badgeVisit, setBadgeVisit] = useState<Visit | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [successMsg, setSuccessMsg] = useState('');
  const [actionErr, setActionErr] = useState('');

  const loadVisits = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .gte('created_at', `${today}T00:00:00Z`)
      .order('created_at', { ascending: false });
    if (error) { console.error('[Console] loadVisits error:', error.message); }
    let rows = ((data as unknown as Visit[]) ?? []);
    rows = await attachHostNames(rows);
    setVisits(rows.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    setLoading(false);
  }, [today]);

  useEffect(() => {
    void loadVisits();
    const channel = supabase
      .channel('guard-visits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void loadVisits(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadVisits]);

  const logExit = async (visit: Visit) => {
    if (visit.status !== 'checked_in') { setActionErr('Visitor is not checked in.'); return; }
    setActionErr('');
    try {
      const { error } = await supabase.from('visits').update({ status: 'checked_out', checked_out_at: new Date().toISOString(), exit_verified: true }).eq('id', visit.id);
      if (error) { setActionErr(safeErrorMessage(error, 'Failed to log exit.')); return; }
      void loadVisits();
    } catch (err) { setActionErr(safeErrorMessage(err, 'Failed to log exit.')); }
  };

  const checkedIn = visits.filter((v) => v.status === 'checked_in');
  const approved = visits.filter((v) => v.status === 'approved' || v.status === 'walkin_approved');
  const pending = visits.filter((v) => v.status === 'pending_approval');
  const rejected = visits.filter((v) => v.status === 'rejected');

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-navy-900">Guard Console</h1>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-white rounded-xl border border-surface-200 p-3">
          <p className="text-2xl font-bold text-brand-600">{checkedIn.length}</p>
          <p className="text-xs text-navy-400 font-medium">Inside</p>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 p-3">
          <p className="text-2xl font-bold text-success-600">{approved.length}</p>
          <p className="text-xs text-navy-400 font-medium">Approved</p>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 p-3">
          <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
          <p className="text-xs text-navy-400 font-medium">Pending</p>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 p-3">
          <p className="text-2xl font-bold text-danger-600">{rejected.length}</p>
          <p className="text-xs text-navy-400 font-medium">Rejected</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setMode('checkin')}
          className={`p-4 rounded-2xl text-center font-bold text-lg transition-all ${
            mode === 'checkin'
              ? 'bg-brand-600 text-white shadow-lg'
              : 'bg-surface-50 text-navy-500 border border-surface-200 hover:bg-surface-100'
          }`}>
          <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Check In
        </button>
        <button onClick={() => setMode('exit')}
          className={`p-4 rounded-2xl text-center font-bold text-lg transition-all relative ${
            mode === 'exit'
              ? 'bg-brand-600 text-white shadow-lg'
              : 'bg-surface-50 text-navy-500 border border-surface-200 hover:bg-surface-100'
          }`}>
          <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Log Out
          {checkedIn.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[22px] h-[22px] text-xs font-bold px-1.5 rounded-full bg-white/20">{checkedIn.length}</span>
          )}
        </button>
      </div>

      {successMsg && (
        <div className="bg-success-50 text-success-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-semibold">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-success-500 hover:text-success-700 text-xs font-bold">Dismiss</button>
        </div>
      )}
      {actionErr && (
        <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-semibold">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span className="flex-1">{actionErr}</span>
          <button onClick={() => setActionErr('')} className="text-danger-500 hover:text-danger-700 text-xs font-bold">Dismiss</button>
        </div>
      )}

      {mode === 'checkin' && (
        <>
          <CheckInPanel
            today={today}
            onCheckInSuccess={(name) => { setSuccessMsg(`"${name}" checked in successfully.`); void loadVisits(); setTimeout(() => setSuccessMsg(''), 6000); }}
          />
          {rejected.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-danger-600 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                Rejected ({rejected.length})
              </p>
              {rejected.map((v) => (
                <div key={v.id} className="bg-white rounded-xl p-3 border border-surface-200 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-navy-900 text-sm truncate">{v.visitor?.full_name ?? '—'}</p>
                    <p className="text-xs text-navy-400 truncate">{v.department?.name}{v.rejection_reason ? ` · ${v.rejection_reason}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {mode === 'exit' && (
        <div className="space-y-2">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-2xl" />)}</div>
          ) : checkedIn.length === 0 ? (
            <div className="text-center py-16 bg-surface-50 rounded-2xl">
              <svg className="w-10 h-10 mx-auto text-navy-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              <p className="text-navy-400 text-lg font-medium">No one inside right now.</p>
            </div>
          ) : (
            checkedIn.map((v) => {
              const dur = formatDuration(v.checked_in_at);
              return (
                <div key={v.id} className="bg-white rounded-2xl p-4 shadow-sm border border-surface-100 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {v.photo_url ? (
                      <img src={v.photo_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-surface-100 shrink-0 flex items-center justify-center">
                        <svg className="w-5 h-5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-navy-900 truncate">{v.visitor?.full_name ?? '—'}</p>
                      <p className="text-sm text-navy-400 truncate">{v.department?.name} · {dur.text}{dur.isOvertime ? ' Over 9h' : ''}</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); logExit(v); }}
                    className="bg-surface-50 hover:bg-surface-100 text-navy-700 font-bold px-5 py-2.5 rounded-xl text-sm transition-all shrink-0 ml-3">
                    Log Out
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {badgeVisit && (
        <div className="modal-overlay">
          <div className="modal-content p-6 space-y-5">
            <Badge visit={badgeVisit} />
            <div className="flex gap-3 justify-end no-print">
              <button onClick={() => setBadgeVisit(null)} className="btn-secondary">Close</button>
              <button onClick={() => window.print()} className="btn-primary">Print Badge</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
