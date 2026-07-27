import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Visit, Notification } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import OverviewStatCards from './OverviewStatCards';
import OverviewUpcoming from './OverviewUpcoming';
import OverviewOnSite from './OverviewOnSite';
import OverviewNotifications from './OverviewNotifications';

interface Stats {
  inside: number;
  approvedToday: number;
  pending: number;
  rejectedToday: number;
}

export default function HODOverview(): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ inside: 0, approvedToday: 0, pending: 0, rejectedToday: 0 });
  const [upcoming, setUpcoming] = useState<Visit[]>([]);
  const [onSite, setOnSite] = useState<Visit[]>([]);
  const [notifs, setNotifs] = useState<Notification[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      setUserId(uid);
      const jwtDeptId = (data.user?.app_metadata?.department_id as string) ?? '';
      const { data: profile } = await supabase.from('profiles').select('department_id').eq('id', uid).maybeSingle();
      const resolvedDeptId = jwtDeptId || (profile as any)?.department_id || null;
      setDeptId(resolvedDeptId);
      if (resolvedDeptId) {
        const { data: dept } = await supabase.from('departments').select('name').eq('id', resolvedDeptId).maybeSingle();
        setDeptName((dept as any)?.name ?? null);
      }
    });
  }, []);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = useCallback(async (silent = false) => {
    if (!deptId || !userId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const { data: todayData } = await supabase
        .from('visits').select('id, status').eq('department_id', deptId).gte('created_at', `${today}T00:00:00Z`);
      const todayRows = (todayData ?? []) as Array<{ id: string; status: string }>;

      setStats({
        inside: todayRows.filter(r => r.status === 'checked_in').length,
        approvedToday: todayRows.filter(r => r.status === 'approved' || r.status === 'walkin_approved').length,
        pending: todayRows.filter(r => r.status === 'pending_approval').length,
        rejectedToday: todayRows.filter(r => r.status === 'rejected').length,
      });

      const { data: upcomingData } = await supabase
        .from('visits').select('*, visitor:visitors(*), department:departments(id, name, code, created_at)')
        .eq('department_id', deptId).in('status', ['pending_approval', 'approved'])
        .order('created_at', { ascending: true }).limit(100);
      let rows = ((upcomingData as unknown as Visit[]) ?? []);
      rows = await attachHostNames(rows);
      const nowMs = Date.now();
      const isGenuinelyUpcoming = (v: Visit) => v.scheduled_for
        ? new Date(v.scheduled_for).getTime() >= nowMs
        : v.created_at.slice(0, 10) >= today;
      const upcomingSortKey = (v: Visit) => new Date(v.scheduled_for ?? v.created_at).getTime();
      rows = rows
        .filter(isGenuinelyUpcoming)
        .sort((a, b) => upcomingSortKey(a) - upcomingSortKey(b))
        .slice(0, 15);
      setUpcoming(rows.map(v => ({ ...v, photo_url: v.photo_data ?? undefined })));

      const { data: onSiteData } = await supabase
        .from('visits').select('*, visitor:visitors(*), department:departments(id, name, code, created_at)')
        .eq('department_id', deptId).in('status', ['checked_in'])
        .order('checked_in_at', { ascending: false }).limit(20);
      let onSiteRows = ((onSiteData as unknown as Visit[]) ?? []);
      onSiteRows = await attachHostNames(onSiteRows);
      setOnSite(onSiteRows.map(v => ({ ...v, photo_url: v.photo_data ?? undefined })));

      const { data: notifData } = await supabase
        .from('notifications').select('*').eq('recipient_id', userId)
        .order('created_at', { ascending: false }).limit(10);
      setNotifs((notifData ?? []) as Notification[]);
    } catch { /* dashboard is read-only and defensive */ }
    if (!silent) setLoading(false);
  }, [deptId, userId, today]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!deptId || !userId) return;
    const ch = supabase.channel('hod-overview-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits', filter: `department_id=eq.${deptId}` }, () => { void load(true); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [deptId, userId, load]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };
  const dismiss = (id: string) => {
    void supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        {deptName && (
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-500 dark:text-brand-300 mb-1">{deptName} Department</p>
        )}
        <h1 className="font-display text-2xl font-bold text-navy-950 dark:text-white tracking-tight">Overview</h1>
        <p className="text-sm text-navy-400 mt-0.5">Your department at a glance</p>
      </div>

      <OverviewStatCards loading={loading} stats={stats} />

      <OverviewOnSite loading={loading} onSite={onSite} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-3 items-start">
        <OverviewUpcoming loading={loading} upcoming={upcoming} />
        <OverviewNotifications loading={loading} notifs={notifs} onMarkRead={markRead} onDismiss={dismiss} />
      </div>
    </div>
  );
}
