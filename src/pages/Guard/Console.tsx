import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import { formatDateTime, formatTime, formatDuration } from '../../lib/formatDate';
import { maskPhone } from '../../lib/pii';
import { exportToCsv } from '../../lib/exportUtils';
import { Link } from 'react-router-dom';
import VisitorForm from './VisitorForm';
import Badge from '../../components/Badge';
import VisitorDetails from '../../components/VisitorDetails';

type Tab = 'active' | 'register' | 'exit';
type StatusFilter = 'all' | Visit['status'];

export default function GuardConsole(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('active');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [badgeVisit, setBadgeVisit] = useState<Visit | null>(null);
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
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

  const checkIn = async (visit: Visit) => {
    if (visit.status !== 'approved' && visit.status !== 'walkin_approved') { setActionErr('Only approved visits can be checked in.'); return; }
    setActionErr('');
    try {
      const { error } = await supabase.from('visits').update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', visit.id);
      if (error) { setActionErr(safeErrorMessage(error, 'Failed to check in.')); return; }
      void loadVisits();
    } catch (err) { setActionErr(safeErrorMessage(err, 'Failed to check in.')); }
  };

  const STATUS_STYLES: Record<Visit['status'], { bg: string; text: string; dot: string }> = {
    pending_approval: { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500' },
    approved: { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500' },
    walkin_approved: { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500' },
    checked_in: { bg: 'bg-brand-50', text: 'text-brand-700', dot: 'bg-brand-500' },
    checked_out: { bg: 'bg-surface-100', text: 'text-navy-400', dot: 'bg-navy-300' },
    rejected: { bg: 'bg-danger-50', text: 'text-danger-700', dot: 'bg-danger-500' },
  };

  const checkedIn = visits.filter((v) => v.status === 'checked_in');
  const pending = visits.filter((v) => v.status === 'pending_approval');
  const rejected = visits.filter((v) => v.status === 'rejected');
  const approved = visits.filter((v) => v.status === 'approved' || v.status === 'walkin_approved');
  const checkedOut = visits.filter((v) => v.status === 'checked_out');

  const filtered = statusFilter === 'all' ? visits : visits.filter((v) => v.status === statusFilter);

  const stats = [
    { key: 'checked_in' as const, label: 'Inside', count: checkedIn.length, color: 'bg-brand-50 text-brand-700 border-brand-200', activeColor: 'bg-brand-100 border-brand-500 ring-2 ring-brand-200', dot: 'bg-brand-500' },
    { key: 'pending_approval' as const, label: 'Pending', count: pending.length, color: 'bg-warning-50 text-warning-700 border-warning-200', activeColor: 'bg-warning-100 border-warning-500 ring-2 ring-warning-200', dot: 'bg-warning-500' },
    { key: 'approved' as const, label: 'Approved', count: approved.length, color: 'bg-success-50 text-success-700 border-success-200', activeColor: 'bg-success-100 border-success-500 ring-2 ring-success-200', dot: 'bg-success-500' },
    { key: 'rejected' as const, label: 'Rejected', count: rejected.length, color: 'bg-danger-50 text-danger-700 border-danger-200', activeColor: 'bg-danger-100 border-danger-500 ring-2 ring-danger-200', dot: 'bg-danger-500' },
    { key: 'checked_out' as const, label: 'Checked Out', count: checkedOut.length, color: 'bg-surface-100 text-navy-500 border-surface-200', activeColor: 'bg-surface-200 border-navy-400 ring-2 ring-surface-300', dot: 'bg-navy-400' },
  ];

  return (
    <div className="space-y-6">
      {detailVisit && <VisitorDetails visit={detailVisit} onClose={() => setDetailVisit(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="page-title">Guard Console</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/kiosk" className="btn-secondary text-sm flex items-center gap-2" title="Open Kiosk Mode">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
            Kiosk
          </Link>
          <button onClick={() => void loadVisits()} className="btn-secondary text-sm flex items-center gap-2" title="Refresh">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
          <button onClick={() => exportToCsv(visits, `console-visits-${today}.csv`)} className="btn-secondary text-sm flex items-center gap-2" title="Export CSV">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s) => (
          <button
            key={s.key}
            onClick={() => { setStatusFilter(statusFilter === s.key ? 'all' : s.key); setTab('active'); }}
            className={`rounded-xl p-3.5 border text-left transition-all duration-200 hover:shadow-md ${
              statusFilter === s.key ? s.activeColor : s.color
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`h-2 w-2 rounded-full ${s.dot} ${statusFilter === s.key ? 'animate-pulse-soft' : ''}`} />
              <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{s.label}</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{s.count}</p>
          </button>
        ))}
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
                  <div className="flex gap-4">
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
          ) : filtered.length === 0 ? (
            <div className="empty-state py-16">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100 mb-3">
                <svg className="w-6 h-6 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
              </div>
              <p className="text-navy-500 font-medium">{statusFilter === 'all' ? 'No visits today yet' : `No ${statusFilter.replace(/_/g, ' ')} visitors`}</p>
              {statusFilter === 'all' && (
                <button onClick={() => setTab('register')} className="mt-2 btn-accent text-sm">
                  Register First Visitor
                </button>
              )}
            </div>
          ) : (
            filtered.map((v, idx) => {
              const style = STATUS_STYLES[v.status];
              const dur = v.status === 'checked_in' ? formatDuration(v.checked_in_at) : null;
              return (
                <div key={v.id} className="card p-4 hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 cursor-pointer animate-fade-in" style={{ animationDelay: `${idx * 0.03}s` }} onClick={() => setDetailVisit(v)}>
                  <div className="flex gap-4 items-start">
                    <div className="shrink-0 relative">
                      {v.photo_url ? (
                        <img src={v.photo_url} alt="" className="w-14 h-[72px] object-cover rounded-xl" style={{ boxShadow: '0 0 0 2px rgba(51,150,255,0.08)' }} />
                      ) : (
                        <div className="w-14 h-[72px] bg-gradient-to-br from-surface-50 to-surface-200 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-navy-900">{v.visitor?.full_name ?? '—'}</p>
                          <p className="text-xs text-navy-400 mt-0.5">
                            {v.visitor?.company ?? ''}{v.visitor?.company && v.visitor?.phone ? ' · ' : ''}{maskPhone(v.visitor?.phone)}
                          </p>
                          <p className="text-xs text-navy-300 mt-0.5">{v.department?.name} · {v.host?.full_name}</p>
                        </div>
                        <span className={`status-badge ${style.bg} ${style.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} style={v.status === 'checked_in' ? { animation: 'pulseRing 2s ease-in-out infinite', color: 'rgb(51,150,255)' } : undefined} />
                          {v.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {/* Info row with subtle separator */}
                      <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid rgba(228,228,231,0.4)' }}>
                        <p className="text-[11px] text-navy-300 font-mono">{v.ref_number}</p>
                        <span className="text-navy-200">·</span>
                        <p className="text-[11px] text-navy-300">Reg: {formatTime(v.created_at)}</p>
                        {v.checked_in_at && (
                          <>
                            <span className="text-navy-200">·</span>
                            <p className="text-[11px] text-navy-300">In: {formatTime(v.checked_in_at)}</p>
                          </>
                        )}
                        {v.checked_out_at && (
                          <>
                            <span className="text-navy-200">·</span>
                            <p className="text-[11px] text-navy-300">Out: {formatTime(v.checked_out_at)}</p>
                          </>
                        )}
                      </div>
                      {dur && (
                        <p className={`text-[11px] mt-1 ${dur.isOvertime ? 'text-danger-600 font-bold' : 'text-navy-400'}`}>
                          Duration: {dur.text}{dur.isOvertime ? ' ⚠️ Over 9 hours' : ''}
                        </p>
                      )}
                      {/* Action buttons */}
                      <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                        {(v.status === 'approved' || v.status === 'walkin_approved') && (
                          <>
                            <button onClick={() => checkIn(v)} className="bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl text-xs px-4 py-2 font-semibold hover:from-brand-700 hover:to-brand-800 active:scale-[0.98] transition-all shadow-soft flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75" /></svg>
                              Check In
                            </button>
                            <button onClick={() => setBadgeVisit(v)} className="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-3 0h.008v.008h-.008V12z" /></svg>
                              Print Badge
                            </button>
                          </>
                        )}
                        {v.status === 'rejected' && v.rejection_reason && (
                          <p className="text-xs text-danger-600 bg-danger-50 px-3 py-2 rounded-lg border border-danger-100">Rejected: {v.rejection_reason}</p>
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
          {checkedIn.map((v) => {
            const dur = formatDuration(v.checked_in_at);
            return (
              <div key={v.id} className="card p-4 flex items-center justify-between gap-4 cursor-pointer hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200" onClick={() => setDetailVisit(v)}>
                <div className="flex items-center gap-3">
                  {v.photo_url ? (
                    <img src={v.photo_url} alt="" className="w-10 h-10 object-cover rounded-lg" style={{ boxShadow: '0 0 0 2px rgba(51,150,255,0.1)' }} />
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-surface-50 to-surface-200 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-navy-900 text-sm">{v.visitor?.full_name ?? '—'}</p>
                    <p className="text-xs text-navy-400">{v.ref_number} · In: {formatTime(v.checked_in_at)}</p>
                    <p className={`text-[11px] ${dur.isOvertime ? 'text-danger-600 font-bold' : 'text-navy-400'}`}>
                      Duration: {dur.text}{dur.isOvertime ? ' ⚠️' : ''}
                    </p>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => logExit(v)} className="bg-gradient-to-r from-navy-900 to-navy-800 text-white rounded-xl text-sm px-5 py-2.5 font-semibold hover:from-navy-800 hover:to-navy-700 active:scale-[0.98] transition-all shadow-soft flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                    Log Exit
                  </button>
                </div>
              </div>
            );
          })}
          {checkedIn.length === 0 && (
            <div className="empty-state py-16">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100 mb-3">
                <svg className="w-6 h-6 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
              </div>
              <p className="text-navy-400 font-medium">No checked-in visitors</p>
            </div>
          )}
        </div>
      )}

      {/* Badge modal */}
      {badgeVisit && (
        <div className="modal-overlay">
          <div className="modal-content p-6 space-y-5">
            <Badge visit={badgeVisit} />
            <div className="flex gap-3 justify-end no-print">
              <button onClick={() => setBadgeVisit(null)} className="btn-secondary">Close</button>
              <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-3 0h.008v.008h-.008V12z" /></svg>
                Print Badge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
