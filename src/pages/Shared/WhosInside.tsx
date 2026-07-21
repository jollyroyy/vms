import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import { formatTime, formatDuration } from '../../lib/formatDate';
import { exportToCsv } from '../../lib/exportUtils';
import VisitorDetails from '../../components/VisitorDetails';

type ActiveTab = 'checked_in' | 'pre_approved' | 'walkin_approved' | 'pending_approval';

export default function WhosInside(): React.ReactElement {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clearError, setClearError] = useState('');
  const [tab, setTab] = useState<ActiveTab>('checked_in');
  const [authReady, setAuthReady] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true); setError(''); setClearError('');
    let query = supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .in('status', ['pending_approval', 'approved', 'walkin_approved', 'checked_in'])
      .gte('created_at', `${today}T00:00:00Z`);
    if (userDeptId && userRole && !['admin', 'super_admin', 'guard'].includes(userRole)) {
      query = query.eq('department_id', userDeptId);
    }
    const { data, error: err } = await query.order('created_at', { ascending: false });
    if (err) { setError(safeErrorMessage(err, 'Failed to load visits.')); }
    let raw = ((data as unknown as Visit[]) ?? []);
    raw = await attachHostNames(raw);
    const enriched = raw.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined }));
    setVisits(enriched);
    setLoading(false);
  }, [userDeptId, userRole, today]);

  useEffect(() => {
    try {
      supabase.auth.getUser().then((res) => {
        const user = res?.data?.user;
        if (user) {
          setUserRole((user.app_metadata?.role as string) ?? null);
          setUserDeptId((user.app_metadata?.department_id as string) ?? null);
        }
      }).finally(() => setAuthReady(true));
    } catch { setAuthReady(true); }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    void load();
    const ch = supabase.channel('whos-inside')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load, authReady]);

  const STATUS_STYLES: Record<Visit['status'], { bg: string; text: string; dot: string; label: string }> = {
    pending_approval: { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500', label: 'Pending' },
    approved:         { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500', label: 'Pre-Approved' },
    walkin_approved:  { bg: 'bg-brand-50', text: 'text-brand-700', dot: 'bg-brand-500', label: 'Approved' },
    checked_in:       { bg: 'bg-brand-50', text: 'text-brand-700', dot: 'bg-brand-500', label: 'Inside' },
    checked_out:      { bg: 'bg-surface-100', text: 'text-navy-400', dot: 'bg-navy-300', label: 'Left' },
    rejected:         { bg: 'bg-danger-50', text: 'text-danger-700', dot: 'bg-danger-500', label: 'Rejected' },
  };

  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveTab | null>(null);
  const [clearing, setClearing] = useState(false);

  const checkedIn = visits.filter((v) => v.status === 'checked_in');
  const pending = visits.filter((v) => v.status === 'pending_approval');
  const preApproved = visits.filter((v) => v.status === 'approved');
  const walkinApproved = visits.filter((v) => v.status === 'walkin_approved');

  const displayed = activeFilter
    ? activeFilter === 'checked_in' ? checkedIn
      : activeFilter === 'pre_approved' ? preApproved
      : activeFilter === 'walkin_approved' ? walkinApproved
      : pending
    : tab === 'checked_in' ? checkedIn
      : tab === 'walkin_approved' ? walkinApproved
      : preApproved;

  const handleClearAll = async () => {
    if (!window.confirm(`Clear all ${preApproved.length} pre-approved visitors? This action cannot be undone.`)) return;
    setClearing(true);
    try {
      const { error: err } = await (supabase as any).rpc('clear_pre_approved');
      if (err) { setClearError(safeErrorMessage(err, 'Failed to clear pre-approved.')); setClearing(false); return; }
      void load();
    } catch (err) { setClearError(safeErrorMessage(err, 'Failed to clear pre-approved.')); }
    finally { setClearing(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {detailVisit && <VisitorDetails visit={detailVisit} onClose={() => setDetailVisit(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
            <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
          </div>
          <div>
            <h1 className="page-title">Who's Inside</h1>
            <p className="page-subtitle flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${visits.length > 0 ? 'bg-brand-500 animate-pulse-soft' : 'bg-navy-300'}`} />
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => void load()} className="no-print btn-secondary text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            Refresh
          </button>
          <button onClick={() => window.print()} className="no-print btn-primary text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-3 0h.008v.008h-.008V12z" /></svg>
            Print Evacuation List
          </button>
          <button onClick={() => exportToCsv(displayed, `whosinside-${today}.csv`)} className="no-print btn-secondary text-sm flex items-center gap-2" title="Export CSV">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Stat summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => { setTab('checked_in'); setActiveFilter(activeFilter === 'checked_in' ? null : 'checked_in'); }}
          className={`stat-card items-center text-center cursor-pointer card-hover animate-slide-up stagger-1 bg-gradient-to-b from-brand-50/60 to-transparent ${activeFilter === 'checked_in' ? 'ring-2 ring-brand-500 shadow-glow-sm' : ''}`}>
          <p className="stat-value text-brand-600">{checkedIn.length}</p>
          <p className="stat-label">Inside</p>
        </button>
        <button onClick={() => { setTab('pre_approved'); setActiveFilter(activeFilter === 'pre_approved' ? null : 'pre_approved'); }}
          className={`stat-card items-center text-center cursor-pointer card-hover animate-slide-up stagger-2 bg-gradient-to-b from-success-50/60 to-transparent ${activeFilter === 'pre_approved' ? 'ring-2 ring-brand-500 shadow-glow-sm' : ''}`}>
          <p className="stat-value text-success-600">{preApproved.length}</p>
          <p className="stat-label">Pre-Approved</p>
        </button>
        <button onClick={() => { setTab('walkin_approved'); setActiveFilter(activeFilter === 'walkin_approved' ? null : 'walkin_approved'); }}
          className={`stat-card items-center text-center cursor-pointer card-hover animate-slide-up stagger-3 bg-gradient-to-b from-brand-50/40 to-transparent ${activeFilter === 'walkin_approved' ? 'ring-2 ring-brand-500 shadow-glow-sm' : ''}`}>
          <p className="stat-value text-brand-600">{walkinApproved.length}</p>
          <p className="stat-label">Approved</p>
        </button>
        <button onClick={() => { setTab('checked_in'); setActiveFilter(activeFilter === 'pending_approval' ? null : 'pending_approval'); }}
          className={`stat-card items-center text-center cursor-pointer card-hover animate-slide-up stagger-4 bg-gradient-to-b from-warning-50/60 to-transparent ${activeFilter === 'pending_approval' ? 'ring-2 ring-brand-500 shadow-glow-sm' : ''}`}>
          <p className="stat-value text-warning-600">{pending.length}</p>
          <p className="stat-label">Pending</p>
        </button>
      </div>

      {/* Active filter indicator */}
      {activeFilter && (
        <div className="flex items-center justify-between text-sm animate-fade-in">
          <span className="glass-chip text-navy-500">
            Showing: <span className="text-navy-800 font-semibold">{activeFilter === 'checked_in' ? 'Currently Inside' : activeFilter === 'pre_approved' ? 'Pre-Approved' : activeFilter === 'walkin_approved' ? 'Walk-in Approved' : 'Pending Approval'}</span>
          </span>
          <button onClick={() => setActiveFilter(null)} className="text-brand-600 hover:text-brand-500 font-medium text-xs transition-colors">Clear filter</button>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-group no-print">
        <button
          onClick={() => { setTab('checked_in'); setActiveFilter(null); }}
          aria-label="Checked In tab"
          className={tab === 'checked_in' ? 'tab-active' : 'tab-inactive'}
        >
          Checked In ({checkedIn.length})
        </button>
        <button
          onClick={() => { setTab('pre_approved'); setActiveFilter(null); }}
          aria-label="Pre-Approved tab"
          className={tab === 'pre_approved' ? 'tab-active' : 'tab-inactive'}
        >
          Pre-Approved ({preApproved.length})
        </button>
        <button
          onClick={() => { setTab('walkin_approved'); setActiveFilter(null); }}
          aria-label="Walk-in Approved tab"
          className={tab === 'walkin_approved' ? 'tab-active' : 'tab-inactive'}
        >
          Approved ({walkinApproved.length})
        </button>
      </div>

      {/* No "Clear All" for walkin_approved — only pre-approved can be batch-cleared */}

      {/* Clear all (pre-approved tab or filter) */}
      {(tab === 'pre_approved' || activeFilter === 'pre_approved') && preApproved.length > 0 && (
        <div className="flex items-center justify-end">
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="no-print text-sm flex items-center gap-2 rounded-xl px-4 py-2 font-medium text-danger-600 hover:bg-danger-50 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            {clearing ? 'Clearing...' : `Clear All (${preApproved.length})`}
          </button>
        </div>
      )}

      {/* Print header */}
      <div className="print-only mb-4">
        <h1 className="text-2xl font-bold">EVACUATION LIST</h1>
        <p className="text-sm text-navy-400">Generated: {new Date().toLocaleString('en-IN')} · Total inside: {checkedIn.length}</p>
      </div>

      {clearError && (
        <div className="alert-error">
          <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {clearError}
        </div>
      )}

      {error && !loading && (
        <div className="alert-error">
          <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          Failed to load: {error}
        </div>
      )}

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card p-4">
              <div className="flex gap-3">
                <div className="w-12 h-16 skeleton rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 skeleton w-2/3" />
                  <div className="h-3 skeleton w-1/2" />
                  <div className="h-3 skeleton w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && displayed.length === 0 && !error && (
        <div className="empty-state py-20">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-surface-100 to-surface-200 mb-4">
            <svg className="w-8 h-8 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>
          </div>
          <p className="text-lg font-medium text-navy-500">
            {tab === 'checked_in' ? 'No visitors inside' : tab === 'walkin_approved' ? 'No walk-in approved visitors' : 'No pre-approved visitors'}
          </p>
          <p className="text-sm text-navy-300 mt-1">
            {tab === 'checked_in' ? 'Checked-in visitors will appear here' : tab === 'walkin_approved' ? 'Approved walk-in visitors awaiting check-in will appear here' : 'Pre-approved visitors waiting to check in will appear here'}
          </p>
        </div>
      )}

      {/* Visitor grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayed.map((v, idx) => {
          const style = STATUS_STYLES[v.status];
          const dur = v.status === 'checked_in' && v.checked_in_at ? formatDuration(v.checked_in_at) : null;
          return (
            <div key={v.id}
              className="card card-hover p-4 cursor-pointer animate-fade-in"
              style={{ animationDelay: `${idx * 0.03}s` }}
              onClick={() => setDetailVisit(v)}
            >
              <div className="flex gap-3 items-start">
                <div className="shrink-0 relative">
                  {v.photo_url ? (
                    <img src={v.photo_url} alt="" className="w-12 h-16 object-cover rounded-xl ring-2 ring-brand-500/10" />
                  ) : (
                    <div className="w-12 h-16 bg-gradient-to-br from-surface-100 to-surface-200 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-semibold text-navy-900 truncate text-sm">{v.visitor?.full_name ?? '—'}</p>
                    <span className={`shrink-0 status-badge ${style.bg} ${style.text}`}>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${style.dot} ${v.status === 'checked_in' ? 'animate-pulse-soft' : ''}`}
                      />
                      {style.label}
                    </span>
                  </div>
                  <p className="text-xs text-navy-400 truncate">{v.visitor?.company}</p>
                  {/* Separator line */}
                  <div className="mt-2 pt-2 border-t border-surface-200/60 dark:border-white/[0.06]">
                    <p className="text-xs text-navy-300 truncate">{v.department?.name} · {v.host?.full_name}</p>
                    <p className="text-xs text-navy-300 mt-0.5">Reg: {formatTime(v.created_at)}</p>
                    {v.checked_in_at && <p className="text-xs text-navy-300">In: {formatTime(v.checked_in_at)}</p>}
                    {v.checked_out_at && <p className="text-xs text-navy-300">Out: {formatTime(v.checked_out_at)}</p>}
                    <p className="text-[10px] text-navy-300 font-mono mt-1">{v.ref_number}</p>
                    {dur && (
                      <p className={`text-xs mt-1 flex items-center gap-1 ${dur.isOvertime ? 'text-danger-600 font-bold' : 'text-navy-400'}`}>
                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Duration: {dur.text}{dur.isOvertime ? ' ⚠️' : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
