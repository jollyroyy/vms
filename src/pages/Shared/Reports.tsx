/**
 * Reports — FR-RPT-01/02/04/05/06 / S12a
 */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit, GatePass } from '../../types/index';
import { getRgpState } from '../../lib/rgpDueDate';
import { attachHostNames } from '../../lib/hostNames';
import { maskPhone } from '../../lib/pii';

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
    rejected: 'text-red-600', checked_out: 'text-navy-300', checked_in: 'text-brand-700', approved: 'text-brand-700', walkin_approved: 'text-brand-700', pending_approval: 'text-amber-600',
  };

  return (
    <div className="space-y-8">
      <div className="page-header !mb-6"><h1 className="page-title">Reports</h1><p className="page-subtitle">Daily visitor register and material tracking</p></div>

      <div className="card p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-navy-600">Date:</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={TODAY} className="input w-auto" />
        </div>
        <button onClick={() => window.print()} className="no-print btn-secondary text-sm ml-auto">Print Register</button>
      </div>

      <div className="print-only"><h2 className="text-xl font-bold">Daily Visitor Register — {date}</h2><p className="text-sm text-gray-500">SecureGate — Mall Management Office</p></div>

      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="section-title">Daily Register — {date}</h2>
          <span className="text-sm text-navy-400">({visits.length} entries)</span>
        </div>
        {loading ? (
          <div className="card p-6 animate-pulse space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-8 bg-surface-100 rounded" />)}</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200">
                    {['#', 'Ref', 'Name', 'Company', 'Phone', 'Dept', 'Host', 'Purpose', 'In', 'Out', 'Status'].map((h) => (
                      <th key={h} className="px-3.5 py-3 text-left font-semibold text-navy-500 text-[11px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {visits.map((v, i) => (
                    <tr key={v.id} className="hover:bg-surface-50/50 transition-colors">
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
          {overdueCount > 0 && (<span className="status-badge bg-red-50 text-red-700">{overdueCount} overdue</span>)}
        </div>
        {openPasses.length === 0 ? (<p className="text-sm text-navy-300">No open returnable passes</p>) : (
          <div className="space-y-2">
            {openPasses.map((p) => {
              const state = p.expected_return_date ? getRgpState(p.expected_return_date, TODAY) : 'ok';
              const stripe: Record<string, string> = { ok: 'border-l-brand-400', due_soon: 'border-l-amber-400', due_today: 'border-l-orange-400', overdue: 'border-l-red-500' };
              const badge: Record<string, string> = { ok: 'bg-brand-50 text-brand-800', due_soon: 'bg-amber-50 text-amber-700', due_today: 'bg-orange-50 text-orange-700', overdue: 'bg-red-50 text-red-700' };
              return (
                <div key={p.id} className={`card border-l-4 ${stripe[state] ?? ''} p-4`}>
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
