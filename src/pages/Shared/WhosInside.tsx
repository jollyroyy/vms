import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';

export default function WhosInside(): React.ReactElement {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: err } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .in('status', ['pending_approval', 'approved', 'checked_in'])
      .order('created_at', { ascending: false });
    if (err) { console.error('[WhosInside] Query error:', err.message); setError(err.message); }
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

  const STATUS_STYLES: Record<Visit['status'], string> = {
    pending_approval: 'bg-amber-50 text-amber-700',
    approved:         'bg-emerald-50 text-emerald-700',
    checked_in:       'bg-brand-50 text-brand-800',
    checked_out:      'bg-surface-100 text-navy-400',
    rejected:         'bg-red-50 text-red-700',
  };

  const checkedIn = visits.filter((v) => v.status === 'checked_in');
  const pending = visits.filter((v) => v.status === 'pending_approval');
  const approved = visits.filter((v) => v.status === 'approved');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Who's Inside</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`h-1.5 w-1.5 rounded-full ${visits.length > 0 ? 'bg-brand-500 animate-pulse' : 'bg-navy-300'}`} />
            <p className="text-sm text-navy-400">
              {checkedIn.length} inside{approved.length > 0 ? ` · ${approved.length} approved` : ''}{pending.length > 0 ? ` · ${pending.length} pending` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="no-print btn-secondary text-sm" title="Refresh">Refresh</button>
          <button onClick={() => window.print()} className="no-print btn-secondary text-sm">Print Evacuation List</button>
        </div>
      </div>

      {/* Print-only evacuation header */}
      <div className="print-only mb-4">
        <h1 className="text-2xl font-bold">EVACUATION LIST</h1>
        <p className="text-sm text-gray-600">Generated: {new Date().toLocaleString('en-IN')} · Total inside: {checkedIn.length}</p>
      </div>

      {error && !loading && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs font-bold shrink-0">!</span>
          Failed to load: {error}
        </div>
      )}

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (<div key={i} className="card p-4 animate-pulse"><div className="flex gap-3"><div className="w-8 h-8 bg-surface-100 rounded-lg" /><div className="flex-1 space-y-2"><div className="h-4 bg-surface-100 rounded w-2/3" /><div className="h-3 bg-surface-100 rounded w-1/2" /></div></div></div>))}
        </div>
      )}

      {!loading && visits.length === 0 && !error && (
        <div className="empty-state py-20">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100 mb-4">
            <svg className="w-8 h-8 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>
          </div>
          <p className="text-lg font-medium text-navy-500">No visitors currently in the premises</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visits.map((v) => (
          <div key={v.id} className="card p-4 hover:shadow-elevated transition-shadow duration-200">
            <div className="flex gap-3 items-start">
              <div className="shrink-0">
                {v.photo_url ? (
                  <img src={v.photo_url} alt="" className="w-12 h-16 object-cover rounded-lg" />
                ) : (
                  <div className="w-12 h-16 bg-surface-100 rounded-lg flex items-center justify-center text-surface-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <p className="font-semibold text-navy-900 truncate">{v.visitor?.full_name ?? '—'}</p>
                  <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${STATUS_STYLES[v.status]}`}>{v.status.replace('_', ' ')}</span>
                </div>
                <p className="text-xs text-navy-400 truncate">{v.visitor?.company}</p>
                <p className="text-xs text-navy-300 mt-1 truncate">{v.department?.name} · {v.host?.full_name}</p>
                <p className="text-xs text-navy-300 mt-0.5">
                  Reg: {new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  {v.checked_in_at ? ` · In: ${new Date(v.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
                <p className="text-[10px] text-navy-300 font-mono mt-0.5">{v.ref_number}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
