/**
 * Analytics — AI-powered insights for HOD and Admin roles
 * Shows department-specific visitor trends, peak hours, approval times, and patterns.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit, GatePass } from '../../types/index';

type TimeSlot = { hour: number; count: number };
type DeptStat = { name: string; total: number; approved: number; rejected: number; avgApprovalMins: number };

export default function AnalyticsPage(): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [userDept, setUserDept] = useState<string>('');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.app_metadata ?? {};
      setUserRole((meta.role as string) ?? '');
      setUserDept((meta.department_id as string) ?? '');
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    let visitQuery = supabase.from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    let gpQuery = supabase.from('gate_passes')
      .select(`*, department:departments(id, name, code, created_at)`)
      .gte('created_at', since);

    // HOD: filter by their department
    if (userRole === 'hod' && userDept) {
      visitQuery = visitQuery.eq('department_id', userDept);
      gpQuery = gpQuery.eq('department_id', userDept);
    }

    const [{ data: v }, { data: g }] = await Promise.all([visitQuery, gpQuery]);
    setVisits((v as unknown as Visit[]) ?? []);
    setGatePasses((g as unknown as GatePass[]) ?? []);
    setLoading(false);
  }, [period, userRole, userDept]);

  useEffect(() => { if (userRole) void load(); }, [load, userRole]);

  // Real-time subscription
  useEffect(() => {
    if (!userRole) return;
    const filters: any = userDept ? { filter: `department_id=eq.${userDept}` } : {};
    const ch = supabase.channel('analytics-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits', ...filters }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gate_passes', ...filters }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userRole, userDept, load]);

  // Compute analytics
  const totalVisits = visits.length;
  const approvedVisits = visits.filter((v) => ['approved', 'walkin_approved', 'checked_in', 'checked_out'].includes(v.status)).length;
  const rejectedVisits = visits.filter((v) => v.status === 'rejected').length;
  const approvalRate = totalVisits > 0 ? Math.round((approvedVisits / totalVisits) * 100) : 0;

  // Peak hours
  const hourCounts: number[] = Array(24).fill(0) as number[];
  visits.forEach((v) => { const h = new Date(v.created_at).getHours(); hourCounts[h] = (hourCounts[h] ?? 0) + 1; });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const topHours: TimeSlot[] = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Average time inside (for checked_out visits)
  const completedVisits = visits.filter((v): v is Visit & { checked_in_at: string; checked_out_at: string } => !!(v.checked_in_at && v.checked_out_at));
  const avgDurationMins = completedVisits.length > 0
    ? Math.round(completedVisits.reduce((sum, v) => sum + (new Date(v.checked_out_at).getTime() - new Date(v.checked_in_at).getTime()) / 60000, 0) / completedVisits.length)
    : 0;

  // Department breakdown (for admins)
  const deptMap = new Map<string, { name: string; visits: Visit[] }>();
  visits.forEach((v) => {
    const key = v.department_id ?? 'unknown';
    if (!deptMap.has(key)) deptMap.set(key, { name: v.department?.name ?? 'Unknown', visits: [] });
    deptMap.get(key)!.visits.push(v);
  });
  const deptStats: DeptStat[] = Array.from(deptMap.entries()).map(([, { name, visits: dv }]) => {
    const approved = dv.filter((v) => ['approved', 'walkin_approved', 'checked_in', 'checked_out'].includes(v.status)).length;
    const rejected = dv.filter((v) => v.status === 'rejected').length;
    return { name, total: dv.length, approved, rejected, avgApprovalMins: 0 };
  }).sort((a, b) => b.total - a.total);

  // Purpose breakdown
  const purposeCounts = new Map<string, number>();
  visits.forEach((v) => { purposeCounts.set(v.purpose, (purposeCounts.get(v.purpose) ?? 0) + 1); });
  const topPurposes = Array.from(purposeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Daily trend
  const dailyCounts = new Map<string, number>();
  visits.forEach((v) => {
    const day = v.created_at.slice(0, 10);
    dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
  });
  const dailyTrend = Array.from(dailyCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const maxDaily = Math.max(...dailyTrend.map(([, c]) => c), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
            <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">
              {userRole === 'hod' ? 'Your department insights' : 'Organization-wide visitor intelligence'}
            </p>
          </div>
        </div>
        <div className="tab-group">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={period === p ? 'tab-active' : 'tab-inactive'}>
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 skeleton w-1/2" />
              <div className="h-8 skeleton w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card card-hover animate-slide-up stagger-1">
              <div className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center mb-2 ring-1 ring-brand-500/10">
                <svg className="w-4.5 h-4.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
              </div>
              <p className="stat-value">{totalVisits}</p>
              <p className="stat-label">Total Visitors</p>
            </div>
            <div className="stat-card card-hover animate-slide-up stagger-2">
              <div className="h-9 w-9 rounded-xl bg-success-50 flex items-center justify-center mb-2 ring-1 ring-success-500/10">
                <svg className="w-4.5 h-4.5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="stat-value">{approvalRate}%</p>
              <p className="stat-label">Approval Rate</p>
            </div>
            <div className="stat-card card-hover animate-slide-up stagger-3">
              <div className="h-9 w-9 rounded-xl bg-warning-50 flex items-center justify-center mb-2 ring-1 ring-warning-500/10">
                <svg className="w-4.5 h-4.5 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="stat-value">{peakHour > 0 ? `${peakHour}:00` : '--'}</p>
              <p className="stat-label">Peak Hour</p>
            </div>
            <div className="stat-card card-hover animate-slide-up stagger-4">
              <div className="h-9 w-9 rounded-xl bg-brand-100 flex items-center justify-center mb-2 ring-1 ring-brand-500/10">
                <svg className="w-4.5 h-4.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" /></svg>
              </div>
              <p className="stat-value">{avgDurationMins > 0 ? `${avgDurationMins}m` : '--'}</p>
              <p className="stat-label">Avg Duration</p>
            </div>
          </div>

          {/* Charts section */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Daily trend */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-navy-800 mb-4">Daily Visitor Trend</h3>
              {dailyTrend.length === 0 ? (
                <p className="text-sm text-navy-300 text-center py-8">No data available</p>
              ) : (
                <div className="space-y-1.5">
                  {dailyTrend.slice(-14).map(([day, count]) => (
                    <div key={day} className="flex items-center gap-3">
                      <span className="text-[10px] text-navy-400 font-mono w-16 shrink-0">{day.slice(5)}</span>
                      <div className="flex-1 h-5 bg-surface-100 rounded-md overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-md transition-all duration-500"
                          style={{ width: `${(count / maxDaily) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-navy-600 w-6 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Peak hours */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-navy-800 mb-4">Peak Hours</h3>
              {topHours.length === 0 ? (
                <p className="text-sm text-navy-300 text-center py-8">No data available</p>
              ) : (
                <div className="space-y-2">
                  {topHours.map(({ hour, count }) => {
                    const maxCount = topHours[0]?.count ?? 1;
                    return (
                      <div key={hour} className="flex items-center gap-3">
                        <span className="text-xs text-navy-500 font-medium w-14 shrink-0">
                          {hour.toString().padStart(2, '0')}:00
                        </span>
                        <div className="flex-1 h-6 bg-surface-100 rounded-lg overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-warning-500 to-warning-600 rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          >
                            {count > 2 && <span className="text-[10px] font-bold text-white">{count}</span>}
                          </div>
                        </div>
                        {count <= 2 && <span className="text-xs font-medium text-navy-500 w-5">{count}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Purpose breakdown */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-navy-800 mb-4">Visit Purpose Breakdown</h3>
              {topPurposes.length === 0 ? (
                <p className="text-sm text-navy-300 text-center py-8">No data available</p>
              ) : (
                <div className="space-y-3">
                  {topPurposes.map(([purpose, count]) => {
                    const pct = Math.round((count / totalVisits) * 100);
                    return (
                      <div key={purpose} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                          <span className="text-sm text-navy-700 capitalize">{purpose}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-navy-400">{count}</span>
                          <span className="text-xs font-semibold text-navy-600 bg-surface-100 px-2 py-0.5 rounded-md">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Department comparison (admin only) */}
            {userRole === 'admin' && (
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-navy-800 mb-4">Department Comparison</h3>
                {deptStats.length === 0 ? (
                  <p className="text-sm text-navy-300 text-center py-8">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {deptStats.map((dept) => (
                      <div key={dept.name} className="flex items-center justify-between py-2 border-b border-surface-200/50 dark:border-white/[0.05] last:border-0">
                        <div>
                          <p className="text-sm font-medium text-navy-800">{dept.name}</p>
                          <div className="flex gap-3 mt-0.5">
                            <span className="text-[10px] text-success-600 font-medium">{dept.approved} approved</span>
                            <span className="text-[10px] text-danger-600 font-medium">{dept.rejected} rejected</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-navy-900">{dept.total}</p>
                          <p className="text-[10px] text-navy-400">visitors</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Gate pass summary */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-navy-800 mb-4">Gate Pass Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-surface-50 rounded-xl">
                <p className="text-2xl font-bold text-navy-900">{gatePasses.length}</p>
                <p className="text-[10px] text-navy-400 uppercase tracking-wide mt-0.5">Total Passes</p>
              </div>
              <div className="text-center p-3 bg-surface-50 rounded-xl">
                <p className="text-2xl font-bold text-brand-600">{gatePasses.filter((g) => g.type === 'RGP').length}</p>
                <p className="text-[10px] text-navy-400 uppercase tracking-wide mt-0.5">Returnable</p>
              </div>
              <div className="text-center p-3 bg-surface-50 rounded-xl">
                <p className="text-2xl font-bold text-navy-600">{gatePasses.filter((g) => g.type === 'NRGP').length}</p>
                <p className="text-[10px] text-navy-400 uppercase tracking-wide mt-0.5">Non-Returnable</p>
              </div>
              <div className="text-center p-3 bg-surface-50 rounded-xl">
                <p className="text-2xl font-bold text-danger-600">{gatePasses.filter((g) => g.status === 'awaiting_return' || g.status === 'partially_returned').length}</p>
                <p className="text-[10px] text-navy-400 uppercase tracking-wide mt-0.5">Open Returns</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
