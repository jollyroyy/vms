import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import VisitorForm from './VisitorForm';
import Badge      from '../../components/Badge';

type Tab = 'register' | 'active' | 'exit';

const TAB_LABELS: Record<Tab, string> = {
  active:   "Today's Visits",
  register: 'New Visitor',
  exit:     'Log Exit',
};

export default function GuardConsole(): React.ReactElement {
  const [tab,         setTab]         = useState<Tab>('active');
  const [visits,      setVisits]      = useState<Visit[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [badgeVisit,  setBadgeVisit]  = useState<Visit | null>(null);
  const [today]                        = useState(() => new Date().toISOString().slice(0, 10));
  const [successMsg,  setSuccessMsg]  = useState('');

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

  const logExit = async (visitId: string) => {
    await supabase.from('visits').update({ status: 'checked_out', checked_out_at: new Date().toISOString(), exit_verified: true }).eq('id', visitId);
    void loadVisits();
  };

  const checkIn = async (visitId: string) => {
    await supabase.from('visits').update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', visitId);
    void loadVisits();
  };

  const STATUS_STYLES: Record<Visit['status'], string> = {
    pending_approval: 'bg-amber-50 text-amber-700',
    approved:         'bg-emerald-50 text-emerald-700',
    checked_in:       'bg-brand-50 text-brand-800',
    checked_out:      'bg-surface-100 text-navy-400',
    rejected:         'bg-red-50 text-red-700',
  };

  const checkedIn = visits.filter((v) => v.status === 'checked_in');
  const pending = visits.filter((v) => v.status === 'pending_approval');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex items-start justify-between flex-wrap gap-2 !mb-6">
        <div>
          <h1 className="page-title">Guard Console</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })} · {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-semibold text-amber-700">{pending.length} pending</span>
            </div>
          )}
          {checkedIn.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-200">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-sm font-semibold text-brand-800">{checkedIn.length} inside</span>
            </div>
          )}
          <button onClick={() => void loadVisits()} className="btn-secondary text-xs px-3 py-1.5" title="Refresh">↻</button>
        </div>
      </div>

      {/* Success message after registration */}
      {successMsg && (
        <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 text-sm text-brand-800 flex items-center gap-2">
          <span className="h-5 w-5 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold shrink-0">✓</span>
          {successMsg}
          <button onClick={() => setSuccessMsg('')} className="ml-auto text-brand-500 hover:text-brand-700 text-xs font-medium">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-group">
        {(['active', 'register', 'exit'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? 'tab-active' : 'tab-inactive'}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'register' && (
        <VisitorForm onRegistered={(name) => { setSuccessMsg(`"${name}" registered — awaiting HOD approval.`); setTab('active'); void loadVisits(); setTimeout(() => setSuccessMsg(''), 6000); }} />
      )}

      {tab === 'active' && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="flex gap-4"><div className="w-14 h-[72px] bg-surface-100 rounded-xl" /><div className="flex-1 space-y-2.5"><div className="h-4 bg-surface-100 rounded w-1/3" /><div className="h-3 bg-surface-100 rounded w-1/2" /></div></div>
                </div>
              ))}
            </div>
          ) : visits.length === 0 ? (
            <div className="empty-state">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100 mb-3">
                <svg className="w-6 h-6 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
              </div>
              <p className="text-navy-400 font-medium">No visits today yet</p>
              <button onClick={() => setTab('register')} className="text-sm text-brand-600 hover:text-brand-700 mt-2 font-medium">
                Register first visitor
              </button>
            </div>
          ) : (
            visits.map((v) => (
              <div key={v.id} className="card p-4 hover:shadow-elevated transition-shadow duration-200">
                <div className="flex gap-4 items-start">
                  <div className="shrink-0">
                    {v.photo_url ? (
                      <img src={v.photo_url} alt="" className="w-14 h-[72px] object-cover rounded-xl" />
                    ) : (
                      <div className="w-14 h-[72px] bg-surface-100 rounded-xl flex items-center justify-center text-surface-300">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-navy-900">{v.visitor?.full_name ?? '—'}</p>
                        <p className="text-xs text-navy-400 mt-0.5">{v.visitor?.company ?? ''}{v.visitor?.company && v.visitor?.phone ? ' · ' : ''}{v.visitor?.phone}</p>
                        <p className="text-xs text-navy-300 mt-0.5">{v.department?.name} · {v.host?.full_name}</p>
                      </div>
                      <span className={`status-badge ${STATUS_STYLES[v.status]}`}>{v.status.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-[11px] text-navy-300 font-mono">{v.ref_number}</p>
                      <p className="text-[11px] text-navy-300">· {new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex gap-2 mt-2.5 flex-wrap">
                      {v.status === 'approved' && (
                        <>
                          <button onClick={() => checkIn(v.id)} className="btn-accent text-xs px-3.5 py-1.5">Check In</button>
                          <button onClick={() => setBadgeVisit(v)} className="btn-secondary text-xs px-3.5 py-1.5">Print Badge</button>
                        </>
                      )}
                      {v.status === 'rejected' && v.rejection_reason && (
                        <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">Rejected: {v.rejection_reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'exit' && (
        <div className="space-y-3">
          <p className="text-sm text-navy-400">Tap "Log Exit" when the visitor leaves the gate.</p>
          {checkedIn.map((v) => (
            <div key={v.id} className="card p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-navy-900">{v.visitor?.full_name ?? '—'}</p>
                <p className="text-xs text-navy-400 mt-0.5">{v.ref_number} · In: {v.checked_in_at ? new Date(v.checked_in_at).toLocaleTimeString('en-IN') : '—'}</p>
              </div>
              <button onClick={() => logExit(v.id)} className="btn-primary text-sm px-5 py-2">Log Exit</button>
            </div>
          ))}
          {checkedIn.length === 0 && (
            <div className="empty-state"><p className="text-navy-300">No visitors currently checked in</p></div>
          )}
        </div>
      )}

      {badgeVisit && (
        <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 space-y-4 max-w-sm w-full shadow-elevated">
            <Badge visit={badgeVisit} />
            <div className="flex gap-2 justify-end no-print">
              <button onClick={() => setBadgeVisit(null)} className="btn-secondary text-sm">Close</button>
              <button onClick={() => window.print()} className="btn-primary text-sm">Print</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-5 text-sm no-print pt-2">
        <Link to="/whos-inside" className="text-brand-700 hover:text-brand-800 font-medium transition-colors">Who's Inside →</Link>
        <Link to="/gate-passes" className="text-brand-700 hover:text-brand-800 font-medium transition-colors">Gate Passes →</Link>
      </div>
    </div>
  );
}
