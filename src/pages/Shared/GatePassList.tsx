/**
 * Gate Pass List — S4/S5, FR-GP-01
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { GatePass } from '../../types/index';
import { getRgpState } from '../../lib/rgpDueDate';

const TODAY = new Date().toISOString().slice(0, 10);
const RGP_STRIPE: Record<string, string> = { ok: '', due_soon: 'border-l-4 border-l-warning-500', due_today: 'border-l-4 border-l-warning-600', overdue: 'border-l-4 border-l-danger-500' };
const RGP_BADGE: Record<string, string> = { ok: 'bg-brand-50 text-brand-700', due_soon: 'bg-warning-50 text-warning-700', due_today: 'bg-warning-100 text-warning-700', overdue: 'bg-danger-50 text-danger-700' };
const FILTER_LABELS: Record<string, string> = { all: 'All', open_rgp: 'Open RGP', overdue: 'Overdue' };

export default function GatePassList(): React.ReactElement {
  const [passes, setPasses] = useState<GatePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open_rgp' | 'overdue'>('all');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  useEffect(() => {
    try {
      supabase.auth.getUser().then((res) => {
        const user = res?.data?.user;
        if (user) {
          setUserRole((user.app_metadata?.role as string) ?? null);
          setUserDeptId((user.app_metadata?.department_id as string) ?? null);
        }
      });
    } catch { /* auth not available */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('gate_passes').select(`*, items:gate_pass_items(*), department:departments(id, name, code, created_at)`);
    if (userDeptId && userRole && !['admin', 'super_admin', 'guard'].includes(userRole)) {
      query = query.eq('department_id', userDeptId);
    }
    if (filter === 'open_rgp') query = query.eq('type', 'RGP').in('status', ['awaiting_return', 'partially_returned']);
    else if (filter === 'overdue') query = query.eq('type', 'RGP').lt('expected_return_date', TODAY);
    const { data } = await query.order('created_at', { ascending: false });
    setPasses((data as unknown as GatePass[]) ?? []);
    setLoading(false);
  }, [filter, userDeptId, userRole]);

  useEffect(() => { void load(); }, [load]);
  const getState = (p: GatePass) => p.type === 'RGP' && p.expected_return_date ? getRgpState(p.expected_return_date, TODAY) : 'ok';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
            <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
          </div>
          <div>
            <h1 className="page-title">Gate Passes</h1>
            <p className="page-subtitle">{passes.length} pass{passes.length !== 1 ? 'es' : ''}</p>
          </div>
        </div>
        <Link to="/gate-passes/new" className="btn-primary text-sm">+ New Gate Pass</Link>
      </div>
      <div className="tab-group">
        {(['all', 'open_rgp', 'overdue'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'tab-active' : 'tab-inactive'}>{FILTER_LABELS[f]}</button>
        ))}
      </div>
      {loading && (<div className="space-y-2">{[1, 2, 3].map((i) => (<div key={i} className="card p-4 space-y-2"><div className="h-4 skeleton w-1/4" /><div className="h-3 skeleton w-1/2" /></div>))}</div>)}
      <div className="space-y-2">
        {passes.map((p, idx) => {
          const state = getState(p);
          return (
            <div key={p.id} className={`card card-hover p-4 animate-fade-in ${RGP_STRIPE[state] ?? ''}`} style={{ animationDelay: `${idx * 0.03}s` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-semibold text-navy-900 text-sm">{p.ref_number}</p>
                  <div className="flex items-center gap-2 text-xs text-navy-400">
                    <span className={`inline-flex px-2 py-0.5 rounded-md font-medium ${p.type === 'RGP' ? 'bg-brand-50 text-brand-700' : 'bg-surface-100 text-navy-500'}`}>{p.type}</span>
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
        {!loading && passes.length === 0 && (
          <div className="empty-state py-20">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-surface-100 to-surface-200 mb-4">
              <svg className="w-8 h-8 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
            </div>
            <p className="text-lg font-medium text-navy-500">No gate passes found</p>
            <p className="text-sm text-navy-300 mt-1">Gate passes you create will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
