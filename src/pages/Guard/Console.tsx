import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import { formatDuration, formatTime } from '../../lib/formatDate';
import CheckInPanel from './CheckInPanel';
import Badge from '../../components/Badge';

export default function GuardConsole(): React.ReactElement {
  const [mode, setMode] = useState<'checkin' | 'exit'>('checkin');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [preApproved, setPreApproved] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [badgeVisit, setBadgeVisit] = useState<Visit | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [successMsg, setSuccessMsg] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [showInsideList, setShowInsideList] = useState(false);

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

    const { data: preData } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .eq('status', 'approved')
      .gte('created_at', `${today}T00:00:00Z`)
      .order('created_at', { ascending: true });
    let preRows = ((preData as unknown as Visit[]) ?? []);
    preRows = await attachHostNames(preRows);
    setPreApproved(preRows.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));

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
      const now = new Date().toISOString();
      const { error } = await supabase.from('visits').update({ status: 'checked_out', checked_out_at: now, exit_verified: true }).eq('id', visit.id);
      if (error) { setActionErr(safeErrorMessage(error, 'Failed to log exit.')); return; }
      void loadVisits();
    } catch (err) { setActionErr(safeErrorMessage(err, 'Failed to log exit.')); }
  };

  /** Returns true if the visit's scheduled time has passed by more than 30 minutes */
  const isExpired = (v: Visit): boolean => {
    if (!v.scheduled_for) return false;
    return Date.now() - new Date(v.scheduled_for).getTime() > 30 * 60 * 1000;
  };

  const checkedIn = visits.filter((v) => v.status === 'checked_in');
  const rejected = visits.filter((v) => v.status === 'rejected');
  const overtimeCount = checkedIn.filter((v) => formatDuration(v.checked_in_at).isOvertime).length;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-navy-900">Guard Console</h1>

      <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden transition-shadow duration-300 hover:shadow-sm">
        <button
          onClick={() => setShowInsideList((prev) => !prev)}
          className="w-full p-5 text-center transition-colors duration-200 hover:bg-surface-50/50"
          aria-expanded={showInsideList}
        >
          <p className="text-4xl font-bold text-brand-600 tracking-tight">{checkedIn.length}</p>
          <p className="text-sm text-navy-400 font-medium mt-0.5">People Inside</p>
          {checkedIn.length > 0 && overtimeCount > 0 && (
            <p className="text-xs text-navy-400 mt-1.5">
              {overtimeCount} {overtimeCount === 1 ? 'visit' : 'visits'} over 9h
            </p>
          )}
          <svg
            className={`w-4 h-4 mx-auto mt-2 text-navy-300 transition-transform duration-300 ${showInsideList ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {showInsideList && (
          <div className="border-t border-surface-200">
            {checkedIn.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-11 h-11 mx-auto rounded-2xl bg-surface-100 flex items-center justify-center mb-2.5">
                  <svg className="w-5 h-5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <p className="text-navy-400 text-sm font-medium">No visitors checked in</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-100">
                {checkedIn.map((v) => {
                  const dur = formatDuration(v.checked_in_at);
                  const checkedInTime = v.checked_in_at ? formatTime(v.checked_in_at) : null;
                  const expected = v.scheduled_for ? formatTime(v.scheduled_for) : null;
                  return (
                    <div key={v.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors duration-150">
                      <div className="relative shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${dur.isOvertime ? 'bg-danger-500' : 'bg-emerald-500'}`} />
                        <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping opacity-40 ${dur.isOvertime ? 'bg-danger-400' : 'bg-emerald-400'}`} />
                      </div>
                      {v.photo_url ? (
                        <img src={v.photo_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0 ring-1 ring-black/5" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-surface-100 shrink-0 flex items-center justify-center ring-1 ring-black/5">
                          <svg className="w-4 h-4 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-navy-900 truncate">{v.visitor?.full_name ?? '—'}</p>
                        <p className="text-xs text-navy-400 truncate">{v.department?.name ?? '—'}{v.purpose ? ` · ${v.purpose}` : ''}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700 border border-brand-100">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                            Checked In
                          </span>
                          {checkedInTime && (
                            <span className="text-[10px] text-navy-300 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              In: {checkedInTime}
                            </span>
                          )}
                          {expected && (
                            <span className="text-[10px] text-navy-300 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                              Sch: {expected}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-3 ml-2">
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${dur.isOvertime ? 'text-danger-600' : 'text-navy-700'}`}>{dur.text}</p>
                          {dur.isOvertime && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-danger-50 text-danger-600 leading-none mt-0.5">
                              Over 9h
                            </span>
                          )}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); logExit(v); }}
                          className="bg-surface-50 hover:bg-surface-100 text-navy-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-all border border-surface-200">
                          Check Out
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
          Check Out
          {checkedIn.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[22px] h-[22px] text-xs font-bold px-1.5 rounded-full bg-white/20">{checkedIn.length}</span>
          )}
        </button>
      </div>

      {/* Expected Today */}
      {preApproved.length > 0 && (
        <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-surface-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              </div>
              <p className="text-sm font-bold text-navy-900">Expected Today</p>
            </div>
            <span className="text-xs font-bold text-navy-400 bg-surface-100 px-2.5 py-1 rounded-lg">{preApproved.length} waiting</span>
          </div>
          <div className="divide-y divide-surface-100">
            {preApproved.map((v) => {
              const expired = isExpired(v);
              return (
                <div key={v.id} className={`flex items-center gap-3 px-5 py-3 transition-colors ${expired ? 'opacity-50' : 'hover:bg-surface-50'}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${expired ? 'bg-navy-300' : 'bg-success-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-900 truncate">{v.visitor?.full_name ?? '—'}</p>
                    <p className="text-xs text-navy-400 truncate">{v.department?.name}{v.purpose ? ` · ${v.purpose}` : ''}</p>
                    {expired ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-danger-50 text-danger-700 border border-danger-100 mt-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-danger-500" />
                        Expired
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-success-50 text-success-700 border border-success-100 mt-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                        Awaiting Arrival
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {v.scheduled_for ? (
                      <span className={`text-sm font-bold px-2.5 py-1 rounded-lg border ${
                        expired ? 'text-navy-400 bg-surface-50 border-surface-200 line-through' : 'text-brand-600 bg-brand-50 border-brand-100'
                      }`}>
                        {formatTime(v.scheduled_for)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-navy-300">No ETA</span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      v.purpose === 'vendor' ? 'bg-purple-50 text-purple-700' :
                      v.purpose === 'delivery' ? 'bg-blue-50 text-blue-700' :
                      v.purpose === 'maintenance' ? 'bg-amber-50 text-amber-700' :
                      'bg-surface-100 text-navy-500'
                    }`}>
                      {(v.purpose ?? 'Other').charAt(0).toUpperCase() + (v.purpose ?? 'other').slice(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                    Check Out
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
