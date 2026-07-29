/**
 * Analytics — AI-powered insights for HOD and Admin roles
 * Shows department-specific visitor trends, peak hours, approval times, and patterns.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit, GatePass } from '../../types/index';
import AnalyticsKPICards from './AnalyticsKPICards';
import AnalyticsCharts, { type TimeSlot, type DeptStat } from './AnalyticsCharts';
import AnalyticsGatePassSummary from './AnalyticsGatePassSummary';

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
          <AnalyticsKPICards
            totalVisits={totalVisits}
            approvalRate={approvalRate}
            peakHour={peakHour}
            avgDurationMins={avgDurationMins}
          />

          {/* Charts section */}
          <AnalyticsCharts
            dailyTrend={dailyTrend}
            maxDaily={maxDaily}
            topHours={topHours}
            topPurposes={topPurposes}
            totalVisits={totalVisits}
            userRole={userRole}
            deptStats={deptStats}
          />

          {/* Gate pass summary */}
          <AnalyticsGatePassSummary gatePasses={gatePasses} />
        </>
      )}
    </div>
  );
}
