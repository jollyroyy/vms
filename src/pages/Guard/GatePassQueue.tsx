import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { GatePass } from '../../types/index';
import GateSignoffPanel from '../../components/gatePass/GateSignoffPanel';

const FILTER_LABELS: Record<string, string> = { all: 'All Ready', rgp_out: 'RGP Out', nrgp: 'NRGP', returns: 'Returns' };

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-success-50 text-success-700',
  awaiting_return: 'bg-warning-50 text-warning-700',
  partially_returned: 'bg-accent-50 text-accent-700',
  returned: 'bg-brand-50 text-brand-700',
  closed: 'bg-surface-100 text-navy-500',
  rejected: 'bg-danger-50 text-danger-700',
};

export default function GatePassQueue(): React.ReactElement {
  const [passes, setPasses] = useState<GatePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'rgp_out' | 'nrgp' | 'returns'>('all');
  const [search, setSearch] = useState('');
  const [selectedPass, setSelectedPass] = useState<GatePass | null>(null);

  const loadPasses = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('gate_passes')
      .select(`*, items:gate_pass_items(*), department:departments(id, name)`)
      .order('created_at', { ascending: false });

    if (filter === 'all') query = query.eq('status', 'approved');
    else if (filter === 'rgp_out') query = query.eq('type', 'RGP').eq('status', 'approved');
    else if (filter === 'nrgp') query = query.eq('type', 'NRGP').eq('status', 'approved');
    else if (filter === 'returns') query = query.in('status', ['awaiting_return', 'partially_returned']);

    const { data } = await query;
    setPasses((data as unknown as GatePass[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { void loadPasses(); }, [loadPasses]);

  const filtered = passes.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.ref_number.toLowerCase().includes(q) ||
      (p.carrier_name ?? '').toLowerCase().includes(q) ||
      (p.company_name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
            <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div>
            <h1 className="page-title">Gate Pass Queue</h1>
            <p className="page-subtitle">{filtered.length} ready pass{filtered.length !== 1 ? 'es' : ''}</p>
          </div>
        </div>
      </div>

      <div className="tab-group">
        {(['all', 'rgp_out', 'nrgp', 'returns'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'tab-active' : 'tab-inactive'}>
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search by ref, carrier, or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm text-navy-900 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
        />
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="h-4 skeleton w-1/4" />
              <div className="h-3 skeleton w-1/2" />
              <div className="h-3 skeleton w-1/3" />
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="empty-state py-20">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-surface-100 to-surface-200 mb-4">
                <svg className="w-8 h-8 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-navy-500">No gate passes ready</p>
              <p className="text-sm text-navy-300 mt-1">Approved gate passes will appear here</p>
            </div>
          ) : (
            filtered.map((p, idx) => (
              <div
                key={p.id}
                className="card card-hover p-4 animate-fade-in cursor-pointer"
                style={{ animationDelay: `${idx * 0.03}s` }}
                onClick={() => setSelectedPass(p)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-bold text-navy-900 text-sm">{p.ref_number}</p>
                    <div className="flex items-center gap-2 text-xs text-navy-400 flex-wrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-md font-medium ${p.type === 'RGP' ? 'bg-brand-50 text-brand-700' : 'bg-surface-100 text-navy-500'}`}>
                        {p.type}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded-md bg-surface-50 text-navy-500 border border-surface-200">{p.direction}</span>
                      <span>{p.department?.name}</span>
                    </div>
                    <p className="text-xs text-navy-400 truncate max-w-md">{p.reason}</p>
                    {p.carrier_name && <p className="text-xs text-navy-400">Carrier: {p.carrier_name}</p>}
                    {p.company_name && <p className="text-xs text-navy-400">Company: {p.company_name}</p>}
                    {(p.items ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(p.items ?? []).map((item, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-50 border border-surface-200/60 text-xs text-navy-600">
                            {item.description} <span className="text-navy-400">x{item.qty}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {p.type === 'RGP' && p.expected_return_date && (
                      <p className="text-xs text-navy-400">Expected return: {p.expected_return_date}</p>
                    )}
                  </div>
                  <span className={`status-badge shrink-0 capitalize ${STATUS_COLORS[p.status] ?? 'bg-surface-100 text-navy-500'}`}>
                    {p.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {selectedPass && (
        <div className="modal-overlay" onClick={() => setSelectedPass(null)}>
          <div className="modal-content p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <GateSignoffPanel pass={selectedPass} onClose={() => setSelectedPass(null)} onUpdated={() => void loadPasses()} />
          </div>
        </div>
      )}
    </div>
  );
}
