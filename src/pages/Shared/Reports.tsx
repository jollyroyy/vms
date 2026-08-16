/**
 * Reports — FR-RPT-01/02/04/05/06 / S12a
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { attachVisitActors } from '../../lib/visitActors';
import { visitStatusLabel } from '../../lib/visitStatusLabel';
import { maskPhone, maskIdProof } from '../../lib/pii';
import { approvalTimestamp } from '../../lib/visitApproval';
import { computeDateRange, type RangePreset } from '../../lib/reportsDateRange';
import type { ReportVisit } from '../../lib/reportRow';
import { ALL_DEPTS, deptOptions, filterVisitsByDept } from '../../lib/reportsDeptFilter';
import ReportsToolbar from './ReportsToolbar';
import ReportsDeptFilter from './ReportsDeptFilter';
import ReportsPrintHeader from './ReportsPrintHeader';

const TODAY = new Date().toISOString().slice(0, 10);

export default function ReportsPage(): React.ReactElement {
  const [date, setDate] = useState(TODAY);
  const [preset, setPreset] = useState<RangePreset>('today');
  const [visits, setVisits] = useState<ReportVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);
  const [deptId, setDeptId] = useState<string>(ALL_DEPTS);

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

  // One source of truth for "does this viewer see more than one department".
  // It decides both the server-side scoping below and whether the department
  // filter is offered at all — an HOD locked to their own department has
  // nothing to pick between, so showing them a picker would be a lie.
  const deptScoped = Boolean(userDeptId && userRole && !['admin', 'guard'].includes(userRole));

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('visits').select(`*, visitor:visitors(*), department:departments(id,name,code,created_at)`)
      .gte('created_at', `${range.from}T00:00:00Z`).lte('created_at', `${range.to}T23:59:59Z`);
    if (deptScoped && userDeptId) {
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
  }, [range.from, range.to, userDeptId, deptScoped]);

  useEffect(() => { void load(); }, [load]);

  // Options are derived from the loaded rows, so the picker can never offer a
  // department that would open an empty table. That also means a selection can
  // fall out of range when the dates change — resolve it back to All rather
  // than showing an empty register under a department's name.
  const options = useMemo(() => deptOptions(visits), [visits]);
  const activeDeptId = options.some((o) => o.id === deptId) ? deptId : ALL_DEPTS;
  const activeDept = options.find((o) => o.id === activeDeptId) ?? null;
  const shown = filterVisitsByDept(visits, activeDeptId);

  const STATUS_COLORS: Record<string, string> = {
    rejected: 'text-danger-600', checked_out: 'text-navy-300', checked_in: 'text-brand-600', approved: 'text-brand-600', walkin_approved: 'text-brand-600', pending_approval: 'text-warning-600',
  };
  // Rejected/approved statuses render as a full sentence ("Rejected by Jane (Host)") —
  // CSS capitalize would upper-case every word ("By", "Host"), so only plain statuses get it.
  const PLAIN_STATUS: Record<string, boolean> = {
    pending_approval: true, checked_in: true, checked_out: true, cancelled: true, no_show: true,
  };

  // Carrying is two columns, not one — the flag is a yes/no fact the admin can
  // scan down, the remarks are what the guard typed at the gate. Crushing them
  // into one cell made "carried something, nothing written down" look identical
  // to "carried nothing", and made the flag impossible to count.
  const carryingFlag = (v: Visit): string => (v.carrying_material ? 'Yes' : 'No');

  // `carrying_material` predates the free-text column, so rows written before it
  // still only say *that* something was carried. Say so rather than showing a
  // blank that reads as "nothing was carried".
  const carryingRemarks = (v: Visit): string => {
    const remarks = v.carrying_remarks?.trim();
    if (remarks) return remarks;
    return v.carrying_material ? 'Not recorded' : '—';
  };

  const dateTime = (iso: string | null | undefined): React.ReactNode => {
    if (!iso) return '—';
    const d = new Date(iso);
    return (
      <>
        <span className="block">{d.toLocaleDateString('en-IN')}</span>
        <span className="block text-navy-500 dark:text-navy-400">{d.toLocaleTimeString('en-IN')}</span>
      </>
    );
  };

  const dateLabel = preset === 'today' ? range.to : `${range.from} to ${range.to}`;
  // A filtered register that prints or exports without naming its department is
  // an undated-looking document that quietly omits most of the day's visitors.
  const rangeLabel = activeDept ? `${activeDept.name} · ${dateLabel}` : dateLabel;
  const dateSuffix = preset === 'today' ? range.to : `${range.from}_to_${range.to}`;
  const filenameSuffix = activeDept
    ? `${(activeDept.code ?? activeDept.name).replace(/\s+/g, '-').toLowerCase()}-${dateSuffix}`
    : dateSuffix;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* The scope of the register belongs beside its title, not buried in the
          toolbar among the date controls: it names WHAT you are looking at,
          while the toolbar changes WHEN and what you do with it. */}
      <div className="page-header !mb-6 flex items-center gap-3.5 flex-wrap no-print">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
          <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
        </div>
        <div>
          <p className="revamp-greeting-eyebrow">Operations</p>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Daily visitor register</p>
        </div>
        {!deptScoped && (
          <div className="ml-auto">
            <ReportsDeptFilter options={options} value={activeDeptId} onChange={setDeptId} total={visits.length} />
          </div>
        )}
      </div>

      <ReportsToolbar
        date={date}
        today={TODAY}
        onDateChange={setDate}
        preset={preset}
        onPresetChange={setPreset}
        visits={shown}
        filenameSuffix={filenameSuffix}
      />

      <div className="print-only">
        <ReportsPrintHeader rangeLabel={`Register — ${rangeLabel}`} entryCount={shown.length} />
      </div>

      <section>
        <div className="revamp-section-head mb-4 no-print">
          <span className="revamp-section-rule" aria-hidden="true" />
          <h2 className="section-title">Register — {rangeLabel}</h2>
          <span className="glass-chip text-navy-500 dark:text-navy-400 tabular-nums">({shown.length} entries)</span>
          {activeDept && (
            <span className="glass-chip text-navy-500">
              Filtered to {activeDept.name} · {visits.length - shown.length} hidden
            </span>
          )}
        </div>
        {loading ? (
          <div className="card p-6 space-y-3 no-print">{[1, 2, 3].map((i) => <div key={i} className="h-8 skeleton" />)}</div>
        ) : (
          /* The register is drawn in the DASHBOARD's row language (client
             instruction, 2026-08-16): the same glass panel, the same uppercase
             11px header band, the same hairline row rule and brand-tinted hover
             as components/DashboardVisitorTable, so a report and the board it
             was read off do not look like two products. The COLUMNS are
             untouched — all sixteen, in order — because styles/print.css pins
             the printed register's widths by `nth-child`, and the two must stay
             in step. */
          <div className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm print:p-0 print:border-0 print:bg-transparent print:shadow-none">
            <div className="rounded-xl border border-surface-200/60 dark:border-white/[0.08] print:border-0">
              <div className="overflow-x-auto print:overflow-visible">
                <table className="register-table w-full text-sm tabular-nums">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-navy-500 bg-surface-100/50 dark:bg-white/[0.03]">
                      {['#', 'Ref', 'Photo', 'Visitor Name', 'Vendor', 'Phone', 'Dept', 'Person to Meet', 'ID Proof', 'Purpose', 'Carrying', 'Carrying Remarks', 'Approved', 'Check-in', 'Check-out', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((v, i) => (
                      <tr key={v.id} className="border-t border-surface-200/50 dark:border-white/[0.05] transition-colors hover:bg-brand-600/5">
                        <td className="px-4 py-3 text-[#9aa3af] dark:text-[#b7c0cb] tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3 text-[11px] font-mono text-navy-500 dark:text-navy-400">{v.ref_number}</td>
                        {/* Round, brand-ringed, and the same size as the board's
                            face — a visitor is recognised the same way on both. */}
                        <td className="px-4 py-3">
                          {v.photo_url ? (
                            <img src={v.photo_url} alt="Visitor photo" className="w-8 h-8 rounded-full object-cover ring-2 ring-brand-500/25" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-surface-100 dark:bg-white/[0.06] flex items-center justify-center text-navy-500 ring-1 ring-black/5">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-navy-950 dark:text-white">{v.visitor?.full_name}</td>
                        <td className="px-4 py-3 text-[#9aa3af] dark:text-[#b7c0cb] font-medium">{v.visitor?.vendor_name}</td>
                        <td className="px-4 py-3 text-[#9aa3af] dark:text-[#b7c0cb] font-mono text-xs">{maskPhone(v.visitor?.phone)}</td>
                        <td className="px-4 py-3 text-[#9aa3af] dark:text-[#b7c0cb] font-medium">{v.department?.name}</td>
                        <td className="px-4 py-3 text-[#9aa3af] dark:text-[#b7c0cb] font-medium">{v.host?.full_name}</td>
                        <td className="px-4 py-3 text-[#9aa3af] dark:text-[#b7c0cb] font-mono text-xs whitespace-nowrap">{maskIdProof(v.visitor?.id_type, v.visitor?.id_last4)}</td>
                        <td className="px-4 py-3 text-[#9aa3af] dark:text-[#b7c0cb] font-medium capitalize">{v.purpose}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <span className={v.carrying_material ? 'font-bold text-accent-700 dark:text-accent-300' : 'text-[#9aa3af] dark:text-[#b7c0cb]'}>
                            {carryingFlag(v)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#9aa3af] dark:text-[#b7c0cb] max-w-[14rem]">
                          <span className="block truncate" title={v.carrying_remarks ?? undefined}>{carryingRemarks(v)}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#9aa3af] dark:text-[#b7c0cb] font-medium tabular-nums whitespace-nowrap">{dateTime(approvalTimestamp(v))}</td>
                        <td className="px-4 py-3 text-xs text-[#9aa3af] dark:text-[#b7c0cb] font-medium tabular-nums whitespace-nowrap">{dateTime(v.checked_in_at)}</td>
                        <td className="px-4 py-3 text-xs text-[#9aa3af] dark:text-[#b7c0cb] font-medium tabular-nums whitespace-nowrap">{v.checked_out_at ? dateTime(v.checked_out_at) : v.exit_verified === false ? 'Auto-closed' : '—'}</td>
                        <td className={`px-4 py-3 font-medium ${PLAIN_STATUS[v.status] ? 'capitalize' : ''} ${STATUS_COLORS[v.status] ?? 'text-navy-500'}`}>{visitStatusLabel(v)}</td>
                      </tr>
                    ))}
                    {shown.length === 0 && (
                      <tr><td colSpan={16} className="px-4 py-10">
                      <div className="revamp-empty">
                        <div className="revamp-empty-medallion">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
                        </div>
                        <p className="revamp-empty-title">No entries in this range</p>
                        <p className="revamp-empty-sub">{activeDept
                          ? `No ${activeDept.name} visits between ${range.from} and ${range.to}`
                          : `No visits between ${range.from} and ${range.to}`}</p>
                      </div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Only the table header repeats across pages, so the register needs an
          explicit end-of-report block — otherwise a printed copy has no way to
          show it is complete and no place to sign it off. */}
      <div className="print-only print-footer">
        <p className="print-meta">End of register · {shown.length} {shown.length === 1 ? 'entry' : 'entries'} · {rangeLabel}</p>
        <p className="print-meta">Confidential — contains personal data. Phone and ID numbers are masked.</p>
        <div className="print-signature"><span className="print-meta">Verified by</span></div>
      </div>
    </div>
  );
}
