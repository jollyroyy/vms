import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';

type ActiveTab = 'checked_in' | 'pre_approved' | 'walkin_approved';

export default function WhosInside(): React.ReactElement {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clearError, setClearError] = useState('');
  const [tab, setTab] = useState<ActiveTab>('checked_in');

  const load = useCallback(async () => {
    setLoading(true); setError(''); setClearError('');
    const { data, error: err } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .in('status', ['pending_approval', 'approved', 'walkin_approved', 'checked_in'])
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); }
    let raw = ((data as unknown as Visit[]) ?? []);
    raw = await attachHostNames(raw);
    const enriched = raw.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined }));
    setVisits(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase.channel('whos-inside')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const STATUS_STYLES: Record<Visit['status'], { bg: string; text: string; dot: string; label: string }> = {
    pending_approval: { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500', label: 'Pending' },
    approved:         { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500', label: 'Pre-Approved' },
    walkin_approved:  { bg: 'bg-brand-50', text: 'text-brand-700', dot: 'bg-brand-500', label: 'Approved' },
    checked_in:       { bg: 'bg-brand-50', text: 'text-brand-700', dot: 'bg-brand-500', label: 'Inside' },
    checked_out:      { bg: 'bg-surface-100', text: 'text-navy-400', dot: 'bg-navy-300', label: 'Left' },
    rejected:         { bg: 'bg-danger-50', text: 'text-danger-700', dot: 'bg-danger-500', label: 'Rejected' },
  };

  const [detailVisits, setDetailVisits] = useState<Visit[] | null>(null);
  const [detailTitle, setDetailTitle] = useState('');
  const [clearing, setClearing] = useState(false);

  const checkedIn = visits.filter((v) => v.status === 'checked_in');
  const pending = visits.filter((v) => v.status === 'pending_approval');
  const preApproved = visits.filter((v) => v.status === 'approved');
  const walkinApproved = visits.filter((v) => v.status === 'walkin_approved');

  const displayed = tab === 'checked_in' ? checkedIn : tab === 'walkin_approved' ? walkinApproved : preApproved;

  const handleClearAll = async () => {
    if (!window.confirm(`Clear all ${preApproved.length} pre-approved visitors? This action cannot be undone.`)) return;
    setClearing(true);
    const { error: err } = await (supabase as any).rpc('clear_pre_approved');
    if (err) { setClearError(err.message); setClearing(false); return; }
    void load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Who's Inside</h1>
          <p className="page-subtitle flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${visits.length > 0 ? 'bg-brand-500 animate-pulse-soft' : 'bg-navy-300'}`} />
            {checkedIn.length} inside · {preApproved.length} pre-approved · {walkinApproved.length} approved{pending.length > 0 ? ` · ${pending.length} pending` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="no-print btn-secondary text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            Refresh
          </button>
          <button onClick={() => window.print()} className="no-print btn-primary text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-3 0h.008v.008h-.008V12z" /></svg>
            Print Evacuation List
          </button>
        </div>
      </div>

      {/* Stat summary */}
      <div className="grid grid-cols-4 gap-3">
        <button onClick={() => { setDetailVisits(checkedIn); setDetailTitle('Currently Inside'); }} className="stat-card items-center text-center cursor-pointer hover:shadow-elevated transition-shadow">
          <p className="stat-value text-brand-600">{checkedIn.length}</p>
          <p className="stat-label">Inside</p>
        </button>
        <button onClick={() => { setDetailVisits(preApproved); setDetailTitle('Pre-Approved Visitors'); }} className="stat-card items-center text-center cursor-pointer hover:shadow-elevated transition-shadow">
          <p className="stat-value text-success-600">{preApproved.length}</p>
          <p className="stat-label">Pre-Approved</p>
        </button>
        <button onClick={() => { setDetailVisits(walkinApproved); setDetailTitle('Walk-in Approved'); }} className="stat-card items-center text-center cursor-pointer hover:shadow-elevated transition-shadow">
          <p className="stat-value text-brand-600">{walkinApproved.length}</p>
          <p className="stat-label">Approved</p>
        </button>
        <button onClick={() => { setDetailVisits(pending); setDetailTitle('Pending Approval'); }} className="stat-card items-center text-center cursor-pointer hover:shadow-elevated transition-shadow">
          <p className="stat-value text-warning-600">{pending.length}</p>
          <p className="stat-label">Pending</p>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-navy-200">
        <button
          onClick={() => setTab('checked_in')}
          aria-label="Checked In tab"
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'checked_in'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-navy-400 hover:text-navy-600'
          }`}
        >
          Checked In ({checkedIn.length})
        </button>
        <button
          onClick={() => setTab('pre_approved')}
          aria-label="Pre-Approved tab"
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'pre_approved'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-navy-400 hover:text-navy-600'
          }`}
        >
          Pre-Approved ({preApproved.length})
        </button>
        <button
          onClick={() => setTab('walkin_approved')}
          aria-label="Walk-in Approved tab"
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'walkin_approved'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-navy-400 hover:text-navy-600'
          }`}
        >
          Approved ({walkinApproved.length})
        </button>
      </div>

      {/* No "Clear All" for walkin_approved — only pre-approved can be batch-cleared */}

      {/* Clear all (pre-approved tab only) */}
      {tab === 'pre_approved' && preApproved.length > 0 && (
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
        <p className="text-sm text-gray-600">Generated: {new Date().toLocaleString('en-IN')} · Total inside: {checkedIn.length}</p>
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
              <div className="flex gap-3 animate-pulse">
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
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100 mb-4">
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
        {displayed.map((v) => {
          const style = STATUS_STYLES[v.status];
          return (
            <div key={v.id} className="card-hover p-4">
              <div className="flex gap-3 items-start">
                <div className="shrink-0">
                  {v.photo_url ? (
                    <img src={v.photo_url} alt="" className="w-12 h-16 object-cover rounded-xl shadow-xs" />
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
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {style.label}
                    </span>
                  </div>
                  <p className="text-xs text-navy-400 truncate">{v.visitor?.company}</p>
                  <p className="text-xs text-navy-300 mt-1.5 truncate">{v.department?.name} · {v.host?.full_name}</p>
                  <p className="text-xs text-navy-300 mt-0.5">
                    Reg: {new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {v.checked_in_at ? ` · In: ${new Date(v.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </p>
                  <p className="text-[10px] text-navy-300 font-mono mt-1">{v.ref_number}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
              detailVisits.map((v) => {
                const style = STATUS_STYLES[v.status];
                return (
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
                    <span className={`status-badge shrink-0 ${style.bg} ${style.text}`}>{style.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
