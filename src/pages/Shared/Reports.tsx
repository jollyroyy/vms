/**
 * Reports — FR-RPT-01/02/04/05/06 / S12a
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { attachVisitActors } from '../../lib/visitActors';
import { computeDateRange, rangeBounds, type RangePreset } from '../../lib/reportsDateRange';
import { istDateKey } from '../../lib/visitExpiry';
import type { ReportVisit } from '../../lib/reportRow';
import { ALL_DEPTS, deptOptions, filterVisitsByDept } from '../../lib/reportsDeptFilter';
import ReportsToolbar from './ReportsToolbar';
import ReportsAdminBar from './ReportsAdminBar';
import ReportsDeptFilter from './ReportsDeptFilter';
import ReportsAnalytics from './ReportsAnalytics';
import ReportsDownloadCards from './ReportsDownloadCards';
import ReportsRegister from './ReportsRegister';

export default function ReportsPage(): React.ReactElement {
  // The IST date, per mount. It was the UTC key at MODULE scope: wrong before
  // 05:30 IST, and a constant that never rolls over in an open console.
  const today = useMemo(() => istDateKey(new Date()), []);
  const [date, setDate] = useState(today);
  const [preset, setPreset] = useState<RangePreset>('today');
  const [visits, setVisits] = useState<ReportVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);
  const [deptId, setDeptId] = useState<string>(ALL_DEPTS);

  const range = computeDateRange(preset, date);
  // `rangeBounds`, shared with the admin tabs — see ReportsWindow.test.tsx for
  // what the old `T00:00:00Z`..`T23:59:59Z` pair cost the register.
  const bounds = useMemo(() => rangeBounds(range), [range.from, range.to]);

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
  // Two things hang off this: the analytics band and the download cards are an
  // admin's alone, and an admin gets the console's own range bar in place of
  // this page's toolbar. The REGISTER is everybody's again — see below.
  const isAdmin = userRole === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    // `entry_point` is NO LONGER JOINED (2026-08-17): its only reader was the
    // Entry Point Utilization panel, removed on client instruction, and a join
    // nothing reads is a row of data leaving the database for no purpose. The
    // register's seventeen columns never carried it and are untouched —
    // `styles/print.css` pins their widths by nth-child, so a column added or
    // removed here would silently mis-column the printed copy.
    let query = supabase.from('visits').select(`*, visitor:visitors(*), department:departments(id,name,code,created_at)`)
      .gte('created_at', bounds.from).lt('created_at', bounds.to);
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
  }, [bounds.from, bounds.to, userDeptId, deptScoped]);

  useEffect(() => { void load(); }, [load]);

  // Options are derived from the loaded rows, so the picker can never offer a
  // department that would open an empty table. That also means a selection can
  // fall out of range when the dates change — resolve it back to All rather
  // than showing an empty register under a department's name.
  const options = useMemo(() => deptOptions(visits), [visits]);
  const activeDeptId = options.some((o) => o.id === deptId) ? deptId : ALL_DEPTS;
  const activeDept = options.find((o) => o.id === activeDeptId) ?? null;
  const shown = filterVisitsByDept(visits, activeDeptId);

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

      {/* ADMIN ONLY. The charts are an org-wide read — an HOD's register is
          already scoped to one department, so a "Visitors by Day" bar there
          would be that department's day beside a title that does not say so,
          and the guard has no route to this page at all. This is where
          /analytics went (deleted 2026-08-17): the charts are derived from the
          exact rows the CSV cards beside them build, so the two cannot
          disagree. */}
      {isAdmin && !loading && (
        <>
          <ReportsAnalytics visits={shown} from={range.from} to={range.to} />
          <ReportsDownloadCards
            visits={shown}
            from={range.from}
            to={range.to}
            filenameSuffix={filenameSuffix}
          />
        </>
      )}

      {isAdmin ? (
        <ReportsAdminBar
          preset={preset}
          date={date}
          today={today}
          onPresetChange={setPreset}
          onDateChange={setDate}
          visits={shown}
          filenameSuffix={filenameSuffix}
        />
      ) : (
        <ReportsToolbar
          date={date}
          today={today}
          onDateChange={setDate}
          preset={preset}
          onPresetChange={setPreset}
          visits={shown}
          filenameSuffix={filenameSuffix}
        />
      )}

      {/* THE REGISTER IS DRAWN FOR EVERY ROLE AGAIN (client instruction,
          2026-08-18: merge the Visitors Log tab into Reports, keep the reports
          part). It came off this page in the first place because the admin had
          a second copy of it on that tab; with the tab gone the reason went
          with it, and the alternative — an admin console whose report page
          holds charts, four CSV bundles and no visits — would have been the
          only surface in the app that summarises rows it will not show you.
          One register, one `shown`, one redaction seam, one printout. */}
      <ReportsRegister
        shown={shown}
        total={visits.length}
        activeDept={activeDept}
        rangeLabel={rangeLabel}
        from={range.from}
        to={range.to}
        loading={loading}
      />
    </div>
  );
}
