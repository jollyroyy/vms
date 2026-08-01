/**
 * Reports — FR-RPT-01/02/04/05/06 / S12a
 */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { attachVisitActors } from '../../lib/visitActors';
import { visitStatusLabel } from '../../lib/visitStatusLabel';
import { maskPhone, maskIdProof } from '../../lib/pii';
import { approvalTimestamp } from '../../lib/visitApproval';
import { computeDateRange, type RangePreset } from '../../lib/reportsDateRange';
import type { ReportVisit } from '../../lib/reportRow';
import ReportsToolbar from './ReportsToolbar';

const TODAY = new Date().toISOString().slice(0, 10);

export default function ReportsPage(): React.ReactElement {
  const [date, setDate] = useState(TODAY);
  const [preset, setPreset] = useState<RangePreset>('today');
  const [visits, setVisits] = useState<ReportVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  const range = computeDateRange(preset, date);

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
    let query = supabase.from('visits').select(`*, visitor:visitors(*), department:departments(id,name,code,created_at)`)
      .gte('created_at', `${range.from}T00:00:00Z`).lte('created_at', `${range.to}T23:59:59Z`);
    if (userDeptId && userRole && !['admin', 'guard'].includes(userRole)) {
      query = query.eq('department_id', userDeptId);
    }
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) { console.error('[Reports] visits error:', error.message); setVisits([]); }
    else {
      const withHosts = await attachHostNames((data ?? []) as unknown as Visit[]);
      const withActors = await attachVisitActors(withHosts);
      setVisits(withActors.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    }
    setLoading(false);
  }, [range.from, range.to, userDeptId, userRole]);

  useEffect(() => { void load(); }, [load]);

  const STATUS_COLORS: Record<string, string> = {
    rejected: 'text-danger-600', checked_out: 'text-navy-300', checked_in: 'text-brand-600', approved: 'text-brand-600', walkin_approved: 'text-brand-600', pending_approval: 'text-warning-600',
  };
  // Rejected/approved statuses render as a full sentence ("Rejected by Jane (Host)") —
  // CSS capitalize would upper-case every word ("By", "Host"), so only plain statuses get it.
  const PLAIN_STATUS: Record<string, boolean> = {
    pending_approval: true, checked_in: true, checked_out: true, cancelled: true, no_show: true,
  };

  // What the visitor brought in, in the guard's own words. `carrying_material`
  // predates the free-text column, so rows written before it still only say
  // *that* something was carried — say so rather than pretending nothing was.
  const carrying = (v: Visit): string => {
    const remarks = v.carrying_remarks?.trim();
    if (remarks) return remarks;
    return v.carrying_material ? 'Yes (unspecified)' : '—';
  };

  const dateTime = (iso: string | null | undefined): React.ReactNode => {
    if (!iso) return '—';
    const d = new Date(iso);
    return (
      <>
        <span className="block">{d.toLocaleDateString('en-IN')}</span>
        <span className="block text-navy-400">{d.toLocaleTimeString('en-IN')}</span>
      </>
    );
  };

  const rangeLabel = preset === 'today' ? range.to : `${range.from} to ${range.to}`;
  const filenameSuffix = preset === 'today' ? range.to : `${range.from}_to_${range.to}`;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="page-header !mb-6 flex items-center gap-3.5 no-print">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
          <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
        </div>
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Daily visitor register</p>
        </div>
      </div>

      <ReportsToolbar
        date={date}
        today={TODAY}
        onDateChange={setDate}
        preset={preset}
        onPresetChange={setPreset}
        visits={visits}
        filenameSuffix={filenameSuffix}
      />

      <div className="print-only">
        <h2 className="text-xl font-bold">Visitor Register — {rangeLabel}</h2>
        <p className="text-sm text-navy-400">Secure Gate — Visitor Management System · {visits.length} entries</p>
      </div>

      <section>
        <div className="flex items-center gap-3 mb-4 no-print">
          <h2 className="section-title">Register — {rangeLabel}</h2>
          <span className="glass-chip text-navy-400">({visits.length} entries)</span>
        </div>
        {loading ? (
          <div className="card p-6 space-y-3 no-print">{[1, 2, 3].map((i) => <div key={i} className="h-8 skeleton" />)}</div>
        ) : (
          <div className="card overflow-hidden print:border-0 print:shadow-none print:rounded-none">
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
                <thead>
                  <tr className="bg-surface-50/80 border-b border-surface-200/60 dark:border-white/[0.06]">
                    {['#', 'Ref', 'Photo', 'Name', 'Company', 'Phone', 'Dept', 'Host', 'ID Proof', 'Purpose', 'Carrying', 'Approved', 'Check-in', 'Check-out', 'Status'].map((h) => (
                      <th key={h} className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-navy-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200/50 dark:divide-white/[0.05]">
                  {visits.map((v, i) => (
                    <tr key={v.id} className="hover:bg-surface-100/60 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-3.5 py-3 text-navy-300">{i + 1}</td>
                      <td className="px-3.5 py-3 text-[11px] font-mono text-navy-400">{v.ref_number}</td>
                      <td className="px-3.5 py-3">
                        {v.photo_url ? (
                          <img src={v.photo_url} alt="Visitor photo" className="w-10 h-10 rounded-lg object-cover ring-1 ring-black/5" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-navy-300 ring-1 ring-black/5">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-3 font-medium text-navy-800">{v.visitor?.full_name}</td>
                      <td className="px-3.5 py-3 text-navy-500">{v.visitor?.company}</td>
                      <td className="px-3.5 py-3 text-navy-500 font-mono text-xs">{maskPhone(v.visitor?.phone)}</td>
                      <td className="px-3.5 py-3 text-navy-500">{v.department?.name}</td>
                      <td className="px-3.5 py-3 text-navy-500">{v.host?.full_name}</td>
                      <td className="px-3.5 py-3 text-navy-500 font-mono text-xs whitespace-nowrap">{maskIdProof(v.visitor?.id_type, v.visitor?.id_last4)}</td>
                      <td className="px-3.5 py-3 text-navy-500 capitalize">{v.purpose}</td>
                      <td className="px-3.5 py-3 text-xs text-navy-600 max-w-[14rem]">
                        <span className="block truncate" title={v.carrying_remarks ?? undefined}>{carrying(v)}</span>
                      </td>
                      <td className="px-3.5 py-3 text-xs text-navy-700 whitespace-nowrap">{dateTime(approvalTimestamp(v))}</td>
                      <td className="px-3.5 py-3 text-xs text-navy-700 whitespace-nowrap">{dateTime(v.checked_in_at)}</td>
                      <td className="px-3.5 py-3 text-xs text-navy-700 whitespace-nowrap">{v.checked_out_at ? dateTime(v.checked_out_at) : v.exit_verified === false ? 'Auto-closed' : '—'}</td>
                      <td className={`px-3.5 py-3 font-medium ${PLAIN_STATUS[v.status] ? 'capitalize' : ''} ${STATUS_COLORS[v.status] ?? 'text-navy-500'}`}>{visitStatusLabel(v)}</td>
                    </tr>
                  ))}
                  {visits.length === 0 && (<tr><td colSpan={15} className="px-4 py-12 text-center text-navy-300">No visits between {range.from} and {range.to}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
