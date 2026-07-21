import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import VisitorForm from './VisitorForm';
import Badge      from '../../components/Badge';

type Tab = 'active' | 'register' | 'exit';

export default function GuardConsole(): React.ReactElement {
  const [tab,         setTab]         = useState<Tab>('active');
  const [visits,      setVisits]      = useState<Visit[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [badgeVisit,  setBadgeVisit]  = useState<Visit | null>(null);
  const [today]                        = useState(() => new Date().toISOString().slice(0, 10));
  const [successMsg,  setSuccessMsg]  = useState('');
  const [actionErr,   setActionErr]   = useState('');

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
      if (error) { setActionErr(error.message); return; }
      void loadVisits();
    } catch (err) { setActionErr(safeErrorMessage(err, 'Failed to log exit.')); }
  };

  const checkIn = async (visit: Visit) => {
    if (visit.status !== 'approved' && visit.status !== 'walkin_approved') { setActionErr('Only approved visits can be checked in.'); return; }
    setActionErr('');
    try {
      const { error } = await supabase.from('visits').update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', visit.id);
      if (error) { setActionErr(error.message); return; }
      void loadVisits();
    } catch (err) { setActionErr(safeErrorMessage(err, 'Failed to check in.')); }
  };

  const STATUS_STYLES: Record<Visit['status'], { bg: string; text: string; dot: string }> = {
    pending_approval: { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500' },
    approved:         { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500' },
    walkin_approved:  { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500' },
    checked_in:       { bg: 'bg-brand-50', text: 'text-brand-700', dot: 'bg-brand-500' },
    checked_out:      { bg: 'bg-surface-100', text: 'text-navy-400', dot: 'bg-navy-300' },
    rejected:         { bg: 'bg-danger-50', text: 'text-danger-700', dot: 'bg-danger-500' },
  };

  const checkedIn = visits.filter((v) => v.status === 'checked_in');
  const pending = visits.filter((v) => v.status === 'pending_approval');
  const approved = visits.filter((v) => v.status === 'approved' || v.status === 'walkin_approved');
  const [detailVisits, setDetailVisits] = useState<Visit[] | null>(null);
  const [detailTitle, setDetailTitle] = useState('');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Guard Console</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <button onClick={() => void loadVisits()} className="btn-secondary text-sm flex items-center gap-2" title="Refresh">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3">
        <button onClick={() => { setDetailVisits(visits); setDetailTitle('All Today\'s Visits'); }} className="stat-card text-center cursor-pointer hover:shadow-elevated transition-shadow">
          <p className="stat-value">{visits.length}</p>
          <p className="stat-label">Total</p>
        </button>
        <button onClick={() => { setDetailVisits(checkedIn); setDetailTitle('Currently Inside'); }} className="stat-card text-center cursor-pointer hover:shadow-elevated transition-shadow">
          <p className="stat-value text-brand-600">{checkedIn.length}</p>
          <p className="stat-label">Inside</p>
        </button>
        <button onClick={() => { setDetailVisits(pending); setDetailTitle('Pending Approval'); }} className="stat-card text-center cursor-pointer hover:shadow-elevated transition-shadow">
          <p className="stat-value text-warning-600">{pending.length}</p>
          <p className="stat-label">Pending</p>
        </button>
        <button onClick={() => { setDetailVisits(approved); setDetailTitle('Approved (awaiting check-in)'); }} className="stat-card text-center cursor-pointer hover:shadow-elevated transition-shadow">
          <p className="stat-value text-success-600">{approved.length}</p>
          <p className="stat-label">Approved</p>
        </button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="alert-success">
          <svg className="w-4 h-4 text-success-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-success-500 hover:text-success-700 text-xs font-medium ml-auto">Dismiss</button>
        </div>
      )}
      {actionErr && (
        <div className="alert-error">
          <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span className="flex-1">{actionErr}</span>
          <button onClick={() => setActionErr('')} className="text-danger-500 hover:text-danger-700 text-xs font-medium ml-auto">Dismiss</button>
        </div>
      )}

      {/* === PRIMARY ACTION TABS === */}
      {/* Large, clearly separated buttons so the guard never hesitates */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setTab('active')}
          className={`rounded-xl p-4 text-center font-semibold text-sm transition-all border-2 ${
            tab === 'active'
              ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-soft'
              : 'bg-white border-surface-200 text-navy-500 hover:border-surface-300 hover:bg-surface-50'
          }`}
        >
          <svg className="w-5 h-5 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
          Today's Visits
        </button>
        <button
          onClick={() => setTab('register')}
          className={`rounded-xl p-4 text-center font-semibold text-sm transition-all border-2 ${
            tab === 'register'
              ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-soft'
              : 'bg-white border-surface-200 text-navy-500 hover:border-surface-300 hover:bg-surface-50'
          }`}
        >
          <svg className="w-5 h-5 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>
          Register Visitor
        </button>
        <button
          onClick={() => setTab('exit')}
          className={`rounded-xl p-4 text-center font-semibold text-sm transition-all border-2 ${
            tab === 'exit'
              ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-soft'
              : 'bg-white border-surface-200 text-navy-500 hover:border-surface-300 hover:bg-surface-50'
          }`}
        >
          <svg className="w-5 h-5 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
          Log Exit
        </button>
      </div>

      {/* Register tab */}
      {tab === 'register' && (
        <VisitorForm onRegistered={(name) => { setSuccessMsg(`"${name}" registered — awaiting HOD approval.`); setTab('active'); void loadVisits(); setTimeout(() => setSuccessMsg(''), 6000); }} />
      )}

      {/* Active visits tab */}
      {tab === 'active' && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-5">
                  <div className="flex gap-4 animate-pulse">
                    <div className="w-14 h-[72px] skeleton rounded-xl" />
                    <div className="flex-1 space-y-2.5">
                      <div className="h-4 skeleton w-1/3" />
                      <div className="h-3 skeleton w-1/2" />
                      <div className="h-3 skeleton w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : visits.length === 0 ? (
            <div className="empty-state py-16">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100 mb-3">
                <svg className="w-6 h-6 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
              </div>
              <p className="text-navy-500 font-medium">No visits today yet</p>
              <button onClick={() => setTab('register')} className="mt-2 btn-accent text-sm">
                Register First Visitor
              </button>
            </div>
          ) : (
            visits.map((v) => {
              const style = STATUS_STYLES[v.status];
              return (
                <div key={v.id} className="card p-4 hover:shadow-elevated transition-shadow">
                  <div className="flex gap-4 items-start">
                    <div className="shrink-0">
                      {v.photo_url ? (
                        <img src={v.photo_url} alt="" className="w-14 h-[72px] object-cover rounded-xl" />
                      ) : (
                        <div className="w-14 h-[72px] bg-surface-100 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-navy-900">{v.visitor?.full_name ?? '—'}</p>
                          <p className="text-xs text-navy-400 mt-0.5">
                            {v.visitor?.company ?? ''}{v.visitor?.company && v.visitor?.phone ? ' · ' : ''}{v.visitor?.phone}
                          </p>
                          <p className="text-xs text-navy-300 mt-0.5">{v.department?.name} · {v.host?.full_name}</p>
                        </div>
                        <span className={`status-badge ${style.bg} ${style.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {v.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[11px] text-navy-300 font-mono">{v.ref_number}</p>
                        <span className="text-navy-200">·</span>
                        <p className="text-[11px] text-navy-300">{new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      {/* Action buttons */}
                      <div className="flex gap-2 mt-3">
                        {v.status === 'approved' && (
                          <>
                            <button onClick={() => checkIn(v)} className="btn-accent text-xs px-4 py-2">Check In</button>
                            <button onClick={() => setBadgeVisit(v)} className="btn-secondary text-xs px-4 py-2">Print Badge</button>
                          </>
                        )}
                        {v.status === 'rejected' && v.rejection_reason && (
                          <p className="text-xs text-danger-600 bg-danger-50 px-3 py-2 rounded-lg">Rejected: {v.rejection_reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Exit tab */}
      {tab === 'exit' && (
        <div className="space-y-3">
          {checkedIn.length > 0 && (
            <p className="text-sm text-navy-400">Tap "Log Exit" when the visitor leaves.</p>
          )}
          {checkedIn.map((v) => (
            <div key={v.id} className="card p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {v.photo_url ? (
                  <img src={v.photo_url} alt="" className="w-10 h-10 object-cover rounded-lg" />
                ) : (
                  <div className="w-10 h-10 bg-surface-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-navy-900 text-sm">{v.visitor?.full_name ?? '—'}</p>
                  <p className="text-xs text-navy-400">{v.ref_number} · In: {v.checked_in_at ? new Date(v.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                </div>
              </div>
              <button onClick={() => logExit(v)} className="btn-primary text-sm px-5 py-2.5">Log Exit</button>
            </div>
          ))}
          {checkedIn.length === 0 && (
            <div className="empty-state py-16">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100 mb-3">
                <svg className="w-6 h-6 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
              </div>
              <p className="text-navy-400 font-medium">No visitors currently inside</p>
            </div>
          )}
        </div>
      )}

      {/* Visitor detail modal */}
      {detailVisits && (
        <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setDetailVisits(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-modal space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy-900 text-lg">{detailTitle}</h3>
              <button onClick={() => setDetailVisits(null)} className="btn-ghost p-1"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            {detailVisits.length === 0 ? (
              <p className="text-navy-400 text-sm py-8 text-center">No visitors in this category</p>
            ) : (
              detailVisits.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
                  {v.photo_url ? (
                    <img src={v.photo_url} alt="" className="w-10 h-12 object-cover rounded-lg shrink-0" />
                  ) : (
                    <div className="w-10 h-12 bg-surface-100 rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-navy-900 text-sm truncate">{v.visitor?.full_name ?? '—'}</p>
                    <p className="text-xs text-navy-400 truncate">{v.visitor?.company} · {v.department?.name}</p>
                    <p className="text-xs text-navy-300 font-mono">{v.ref_number}</p>
                  </div>
                  <span className={`status-badge shrink-0 ${STATUS_STYLES[v.status].bg} ${STATUS_STYLES[v.status].text}`}>{v.status.replace('_', ' ')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Badge modal */}
      {badgeVisit && (
        <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 space-y-5 max-w-sm w-full shadow-modal">
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
