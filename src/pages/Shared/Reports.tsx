/**
 * Reports — FR-RPT-01/02/04/05/06 / S12a
 */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit, GatePass } from '../../types/index';
import { getRgpState } from '../../lib/rgpDueDate';
import { attachHostNames } from '../../lib/hostNames';
import { maskPhone } from '../../lib/pii';
import { exportToCsv, exportToJson } from '../../lib/exportUtils';

const TODAY = new Date().toISOString().slice(0, 10);

export default function ReportsPage(): React.ReactElement {
  const [date, setDate] = useState(TODAY);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [openPasses, setOpenPasses] = useState<GatePass[]>([]);
  const [loading, setLoading] = useState(true);
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
    const [visitRows, { data: gp }] = await Promise.all([
      (async (): Promise<Visit[]> => {
        let query = supabase.from('visits').select(`*, visitor:visitors(*), department:departments(id,name,code,created_at)`)
          .gte('created_at', `${date}T00:00:00Z`).lte('created_at', `${date}T23:59:59Z`);
        if (userDeptId && userRole && !['admin', 'super_admin', 'guard'].includes(userRole)) {
          query = query.eq('department_id', userDeptId);
        }
        const { data, error } = await query.order('created_at', { ascending: true });
        if (error) { console.error('[Reports] visits error:', error.message); return []; }
        return attachHostNames((data ?? []) as unknown as Visit[]);
      })(),
      (async (): Promise<{ data: unknown; error: unknown }> => {
        let query = supabase.from('gate_passes').select(`*, items:gate_pass_items(*), department:departments(id,name,code,created_at)`)
          .eq('type', 'RGP').in('status', ['awaiting_return', 'partially_returned']);
        if (userDeptId && userRole && !['admin', 'super_admin', 'guard'].includes(userRole)) {
          query = query.eq('department_id', userDeptId);
        }
        return await query;
      })(),
    ]);
    setVisits(visitRows);
    setOpenPasses((gp as unknown as GatePass[]) ?? []);
    setLoading(false);
  }, [date, userDeptId, userRole]);

  useEffect(() => { void load(); }, [load]);
  const overdueCount = openPasses.filter((p) => p.expected_return_date && getRgpState(p.expected_return_date, TODAY) === 'overdue').length;

  const STATUS_COLORS: Record<string, string> = {
    rejected: 'text-danger-600', checked_out: 'text-navy-300', checked_in: 'text-brand-600', approved: 'text-brand-600', walkin_approved: 'text-brand-600', pending_approval: 'text-warning-600',
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="page-header !mb-6 flex items-center gap-3.5">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
          <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
        </div>
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Daily visitor register and material tracking</p>
        </div>
      </div>

      <div className="card p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-navy-600">Date:</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={TODAY} className="input w-auto" />
        </div>
        <button onClick={() => exportToCsv(visits, `register-${date}.csv`)} className="no-print btn-secondary text-sm flex items-center gap-2" title="Export CSV">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          Export CSV
        </button>
        <button onClick={() => exportToJson(visits, `register-${date}.json`)} className="no-print btn-secondary text-sm flex items-center gap-2" title="Export JSON">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          Export JSON
        </button>
        <button onClick={() => window.print()} className="no-print btn-secondary text-sm ml-auto flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-3 0h.008v.008h-.008V12z" /></svg>
          Print Register
        </button>
      </div>

      <div className="print-only"><h2 className="text-xl font-bold">Daily Visitor Register — {date}</h2><p className="text-sm text-navy-400">SecureGate — Mall Management Office</p></div>

      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="section-title">Daily Register — {date}</h2>
          <span className="glass-chip text-navy-400">({visits.length} entries)</span>
        </div>
        {loading ? (
          <div className="card p-6 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-8 skeleton" />)}</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
                <thead>
                  <tr className="bg-surface-50/80 border-b border-surface-200/60 dark:border-white/[0.06]">
                    {['#', 'Ref', 'Name', 'Company', 'Phone', 'Dept', 'Host', 'Purpose', 'In', 'Out', 'Status'].map((h) => (
                      <th key={h} className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-navy-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200/50 dark:divide-white/[0.05]">
                  {visits.map((v, i) => (
                    <tr key={v.id} className="hover:bg-surface-100/60 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-3.5 py-3 text-navy-300">{i + 1}</td>
                      <td className="px-3.5 py-3 text-[11px] font-mono text-navy-400">{v.ref_number}</td>
                      <td className="px-3.5 py-3 font-medium text-navy-800">{v.visitor?.full_name}</td>
                      <td className="px-3.5 py-3 text-navy-500">{v.visitor?.company}</td>
                      <td className="px-3.5 py-3 text-navy-500 font-mono text-xs">{maskPhone(v.visitor?.phone)}</td>
                      <td className="px-3.5 py-3 text-navy-500">{v.department?.name}</td>
                      <td className="px-3.5 py-3 text-navy-500">{v.host?.full_name}</td>
                      <td className="px-3.5 py-3 text-navy-500 capitalize">{v.purpose}</td>
                      <td className="px-3.5 py-3 text-xs text-navy-400 whitespace-nowrap">{v.checked_in_at ? new Date(v.checked_in_at).toLocaleTimeString('en-IN') : '—'}</td>
                      <td className="px-3.5 py-3 text-xs text-navy-400 whitespace-nowrap">{v.checked_out_at ? new Date(v.checked_out_at).toLocaleTimeString('en-IN') : v.exit_verified === false ? 'Auto-closed' : '—'}</td>
                      <td className={`px-3.5 py-3 capitalize font-medium ${STATUS_COLORS[v.status] ?? 'text-navy-500'}`}>{v.status.replace(/_/g, ' ')}</td>
                    </tr>
                  ))}
                  {visits.length === 0 && (<tr><td colSpan={11} className="px-4 py-12 text-center text-navy-300">No visits on {date}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="no-print">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="section-title">Open Returnables (RGP)</h2>
          {overdueCount > 0 && (<span className="status-badge bg-danger-50 text-danger-700">{overdueCount} overdue</span>)}
        </div>
        {openPasses.length === 0 ? (
          <div className="card p-8 text-center"><p className="text-sm text-navy-300">No open returnable passes</p></div>
        ) : (
          <div className="space-y-2">
            {openPasses.map((p, idx) => {
              const state = p.expected_return_date ? getRgpState(p.expected_return_date, TODAY) : 'ok';
              const stripe: Record<string, string> = { ok: 'border-l-brand-400', due_soon: 'border-l-warning-500', due_today: 'border-l-warning-600', overdue: 'border-l-danger-500' };
              const badge: Record<string, string> = { ok: 'bg-brand-50 text-brand-700', due_soon: 'bg-warning-50 text-warning-700', due_today: 'bg-warning-100 text-warning-700', overdue: 'bg-danger-50 text-danger-700' };
              return (
                <div key={p.id} className={`card card-hover border-l-4 ${stripe[state] ?? ''} p-4 animate-fade-in`} style={{ animationDelay: `${idx * 0.03}s` }}>
                  <div className="flex justify-between items-start">
                    <div><p className="font-semibold text-sm text-navy-900">{p.ref_number}</p><p className="text-xs text-navy-400 mt-0.5">{p.department?.name} · {p.reason}</p></div>
                    <span className={`status-badge ${badge[state] ?? ''} capitalize`}>{state.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-navy-300 mt-2">Due: {p.expected_return_date} · Status: {p.status.replace(/_/g, ' ')}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
