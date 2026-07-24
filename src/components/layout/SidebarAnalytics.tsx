import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function SidebarAnalytics({ deptId, isCollapsed }: { deptId: string; isCollapsed: boolean }): React.ReactElement {
  const [counts, setCounts] = useState({ inside: 0, pending: 0, approved: 0, gatePasses: 0 });

  const today = new Date().toISOString().slice(0, 10);

  const refresh = useCallback(async () => {
    const [{ data: visits }, { data: gp }] = await Promise.all([
      supabase.from('visits').select('id, status').eq('department_id', deptId).gte('created_at', `${today}T00:00:00Z`),
      supabase.from('gate_passes').select('id, status').eq('department_id', deptId).gte('created_at', `${today}T00:00:00Z`),
    ]);
    const v = (visits ?? []) as Array<{ id: string; status: string }>;
    const g = (gp ?? []) as Array<{ id: string; status: string }>;
    setCounts({
      inside: v.filter(r => r.status === 'checked_in').length,
      pending: v.filter(r => r.status === 'pending_approval').length,
      approved: v.filter(r => ['approved', 'walkin_approved'].includes(r.status)).length,
      gatePasses: g.length,
    });
  }, [deptId, today]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const ch = supabase.channel('sidebar-analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits', filter: `department_id=eq.${deptId}` }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gate_passes', filter: `department_id=eq.${deptId}` }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [deptId, refresh]);

  if (isCollapsed) {
    return (
      <div className="mx-auto flex flex-col items-center gap-1.5 py-2">
        <div title="Inside now" className="flex flex-col items-center">
          <span className="text-sm font-bold text-brand-600 tabular-nums">{counts.inside}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
        </div>
        <div title="Pending" className="flex flex-col items-center">
          <span className="text-sm font-bold text-amber-600 tabular-nums">{counts.pending}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        </div>
      </div>
    );
  }

  const items = [
    { label: 'Inside Now', value: counts.inside, color: 'text-brand-600', dot: 'bg-success-500 animate-pulse-soft' },
    { label: 'Pending', value: counts.pending, color: 'text-amber-600', dot: 'bg-amber-500' },
    { label: 'Approved', value: counts.approved, color: 'text-success-600', dot: 'bg-success-500' },
    { label: 'Gate Passes', value: counts.gatePasses, color: 'text-accent-600', dot: 'bg-accent-500' },
  ];

  return (
    <div className="mx-3 rounded-xl border border-surface-200/60 dark:border-white/[0.06] bg-surface-50/80 dark:bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-navy-400">Live Today</span>
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success-500" />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${it.dot}`} />
            <span className={`text-sm font-bold tabular-nums ${it.color}`}>{it.value}</span>
            <span className="text-[10px] text-navy-400 truncate">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
