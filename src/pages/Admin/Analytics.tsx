import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { safeErrorMessage } from '../../lib/errors';

interface DailyStats {
  date: string;
  count: number;
}

interface DeptStats {
  name: string;
  count: number;
}

interface HourlyStats {
  hour: number;
  count: number;
}

export default function Analytics(): React.ReactElement {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [deptStats, setDeptStats] = useState<DeptStats[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [avgDuration, setAvgDuration] = useState<string>('—');
  const [totalVisits, setTotalVisits] = useState(0);
  const [period, setPeriod] = useState<'7' | '30' | '90'>('7');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(period));
      const sinceStr = since.toISOString();

      // Total visits in period
      const { count: total } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sinceStr);
      setTotalVisits(total ?? 0);

      // Daily trend
      const { data: daily } = await supabase
        .from('visits')
        .select('created_at')
        .gte('created_at', sinceStr)
        .order('created_at');
      if (daily) {
        const map = new Map<string, number>();
        daily.forEach((v) => {
          const d = v.created_at.slice(0, 10);
          map.set(d, (map.get(d) ?? 0) + 1);
        });
        setDailyStats(Array.from(map.entries()).map(([date, count]) => ({ date, count })));
      }

      // Department distribution
      const { data: deptData } = await supabase
        .from('visits')
        .select('department:departments(name)')
        .gte('created_at', sinceStr);
      if (deptData) {
        const map = new Map<string, number>();
        deptData.forEach((v: any) => {
          const name = v.department?.name ?? 'Unknown';
          map.set(name, (map.get(name) ?? 0) + 1);
        });
        setDeptStats(Array.from(map.entries()).map(([name, count]) => ({ name, count })));
      }

      // Hourly distribution (from checked_in_at)
      const { data: hourly } = await supabase
        .from('visits')
        .select('checked_in_at')
        .not('checked_in_at', 'is', null)
        .gte('checked_in_at', sinceStr);
      if (hourly) {
        const counts = new Array(24).fill(0);
        hourly.forEach((v) => {
          const h = new Date(v.checked_in_at).getHours();
          counts[h]++;
        });
        setHourlyStats(counts.map((count, hour) => ({ hour, count })));
      }

      // Average duration
      const { data: durations } = await supabase
        .from('visits')
        .select('checked_in_at, checked_out_at')
        .not('checked_in_at', 'is', null)
        .not('checked_out_at', 'is', null)
        .gte('checked_in_at', sinceStr);
      if (durations && durations.length > 0) {
        const totalMs = durations.reduce((sum, v) => {
          return sum + (new Date(v.checked_out_at).getTime() - new Date(v.checked_in_at).getTime());
        }, 0);
        const avgMs = totalMs / durations.length;
        const hours = Math.floor(avgMs / 3600000);
        const mins = Math.floor((avgMs % 3600000) / 60000);
        setAvgDuration(`${hours}h ${mins}m`);
      }
    } catch (err: any) {
      setError(safeErrorMessage(err, 'Failed to load analytics'));
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const maxDaily = Math.max(...dailyStats.map((d) => d.count), 1);
  const maxDept = Math.max(...deptStats.map((d) => d.count), 1);
  const maxHourly = Math.max(...hourlyStats.map((h) => h.count), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header !mb-6 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
          </div>
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">Visitor trends and insights</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="tab-group">
            {(['7', '30', '90'] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={period === p ? 'tab-active' : 'tab-inactive'}>
                {p === '7' ? '7 days' : p === '30' ? '30 days' : '90 days'}
              </button>
            ))}
          </div>
          <button onClick={() => void load()} className="btn-secondary !px-4 !py-2 text-sm inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error">
          <span className="flex-1">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2,3,4].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 skeleton w-1/3 mb-4" />
              <div className="h-32 skeleton" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Summary cards */}
          <div className="stat-card animate-slide-up stagger-1">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                </svg>
              </div>
              <div>
                <p className="stat-value">{totalVisits}</p>
                <p className="stat-label">Total visits ({period}d)</p>
              </div>
            </div>
          </div>
          <div className="stat-card animate-slide-up stagger-2">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-success-50 text-success-600 border border-success-500/20 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="stat-value">{avgDuration}</p>
                <p className="stat-label">Avg visit duration</p>
              </div>
            </div>
          </div>

          {/* Daily trend bar chart */}
          <div className="card p-6 col-span-1 md:col-span-2 animate-slide-up stagger-3">
            <h3 className="section-title mb-4">Daily Visitor Trend</h3>
            <div className="flex items-end gap-1 h-32">
              {dailyStats.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-accent-500 hover:opacity-80 transition-opacity min-h-[4px]"
                    style={{ height: `${(d.count / maxDaily) * 100}%` }}
                    title={`${d.date}: ${d.count}`}
                  />
                  <span className="text-[8px] text-navy-400 rotate-45 origin-left whitespace-nowrap">
                    {d.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Department distribution */}
          <div className="card p-6 animate-slide-up stagger-4">
            <h3 className="section-title mb-4">By Department</h3>
            <div className="space-y-2.5">
              {deptStats.map((d) => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className="text-sm text-navy-600 w-24 truncate">{d.name}</span>
                  <div className="flex-1 bg-surface-100 rounded-full h-2.5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 transition-all" style={{ width: `${(d.count / maxDept) * 100}%` }} />
                  </div>
                  <span className="text-xs text-navy-500 font-mono w-8 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hourly distribution */}
          <div className="card p-6 animate-slide-up stagger-5">
            <h3 className="section-title mb-4">Peak Hours (check-ins)</h3>
            <div className="flex items-end gap-0.5 h-24">
              {hourlyStats.map((h) => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={`w-full rounded-t transition-all ${h.count > 0 ? 'bg-gradient-to-t from-brand-600 to-accent-500 hover:opacity-80' : 'bg-surface-100'}`}
                    style={{ height: `${(h.count / maxHourly) * 100}%` }}
                    title={`${h.hour}:00 - ${h.count}`}
                  />
                  <span className="text-[7px] text-navy-400">{h.hour}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
