/**
 * Gate Pass List — S4/S5, FR-GP-01
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { GatePass } from '../../types/index';
import { getRgpState } from '../../lib/rgpDueDate';

const TODAY = new Date().toISOString().slice(0, 10);
const RGP_STRIPE: Record<string, string> = { ok: '', due_soon: 'border-l-4 border-l-amber-400', due_today: 'border-l-4 border-l-orange-400', overdue: 'border-l-4 border-l-red-500' };
const RGP_BADGE: Record<string, string> = { ok: 'bg-brand-50 text-brand-800', due_soon: 'bg-amber-50 text-amber-700', due_today: 'bg-orange-50 text-orange-700', overdue: 'bg-red-50 text-red-700' };
const FILTER_LABELS: Record<string, string> = { all: 'All', open_rgp: 'Open RGP', overdue: 'Overdue' };

export default function GatePassList(): React.ReactElement {
  const [passes, setPasses] = useState<GatePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open_rgp' | 'overdue'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('gate_passes').select(`*, items:gate_pass_items(*), department:departments(id, name, code, created_at)`).order('created_at', { ascending: false });
    if (filter === 'open_rgp') query = query.eq('type', 'RGP').in('status', ['awaiting_return', 'partially_returned']);
    else if (filter === 'overdue') query = query.eq('type', 'RGP').lt('expected_return_date', TODAY);
    const { data } = await query;
    setPasses((data as unknown as GatePass[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);
  const getState = (p: GatePass) => p.type === 'RGP' && p.expected_return_date ? getRgpState(p.expected_return_date, TODAY) : 'ok';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="page-title">Gate Passes</h1><p className="page-subtitle">{passes.length} pass{passes.length !== 1 ? 'es' : ''}</p></div>
        <Link to="/gate-passes/new" className="btn-primary text-sm">+ New Gate Pass</Link>
      </div>
      <div className="tab-group">
        {(['all', 'open_rgp', 'overdue'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'tab-active' : 'tab-inactive'}>{FILTER_LABELS[f]}</button>
        ))}
      </div>
      {loading && (<div className="space-y-2">{[1, 2, 3].map((i) => (<div key={i} className="card p-4 animate-pulse space-y-2"><div className="h-4 bg-surface-100 rounded w-1/4" /><div className="h-3 bg-surface-100 rounded w-1/2" /></div>))}</div>)}
      <div className="space-y-2">
        {passes.map((p) => {
          const state = getState(p);
          return (
            <div key={p.id} className={`card p-4 hover:shadow-elevated transition-shadow duration-200 ${RGP_STRIPE[state] ?? ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-semibold text-navy-900 text-sm">{p.ref_number}</p>
                  <div className="flex items-center gap-2 text-xs text-navy-400">
                    <span className={`inline-flex px-2 py-0.5 rounded-md font-medium ${p.type === 'RGP' ? 'bg-brand-50 text-brand-800' : 'bg-surface-100 text-navy-500'}`}>{p.type}</span>
                    <span>{p.direction}</span><span>·</span><span>{p.department?.name}</span>
                  </div>
                  <p className="text-xs text-navy-400">Reason: {p.reason}</p>
                  {p.expected_return_date && (
                    <p className="text-xs text-navy-400 mt-1">Due: {p.expected_return_date} <span className={`status-badge ml-1 ${RGP_BADGE[state] ?? ''} capitalize`}>{state.replace('_', ' ')}</span></p>
                  )}
                </div>
                <span className="status-badge bg-surface-100 text-navy-500 capitalize">{p.status.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-xs text-navy-300 mt-2">{(p.items ?? []).length} item{(p.items ?? []).length !== 1 ? 's' : ''}</p>
            </div>
          );
        })}
        {!loading && passes.length === 0 && (<div className="empty-state"><p className="text-navy-300">No gate passes found</p></div>)}
      </div>
    </div>
  );
}
