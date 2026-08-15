import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Visit, Notification, VisitStatus } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { useVisitDecisions } from './useVisitDecisions';
import OverviewStatCards from './OverviewStatCards';
import OverviewUpcoming from './OverviewUpcoming';
import OverviewOnSite from './OverviewOnSite';
import OverviewNotifications from './OverviewNotifications';
import OverviewFilteredView from './OverviewFilteredView';
import OverviewPendingApprovals from './OverviewPendingApprovals';
import VisitorDetails from '../../components/VisitorDetails';

// The two sidebar panels (Walk-in Desk, Visitor Schedule) are query variants of
// /overview. `tab` picks the section the HOD actually came to work on: the
// pending walk-ins awaiting a decision, or the booked visitor schedule. The
// page scrolls to that section on arrival so the panel behaves like a page.
const FOCUS_TABS: Record<string, string> = {
  walkins: 'hod-section-pending',
  schedule: 'hod-section-schedule',
};

interface Stats {
  inside: number;
  approvedToday: number;
  pending: number;
  rejectedToday: number;
}

type FilterKey = 'inside' | 'approved' | 'pending' | 'rejected';

// Direct lookup, so an arbitrary ?filter= value can never select a list.
// `approved` is the pre-approved list — it is where the HOD lands straight after
// pre-approving a visitor (see PreApproveForm -> Approvals -> /overview?filter=approved).
const FILTER_KEYS: Record<string, FilterKey> = {
  inside: 'inside',
  approved: 'approved',
  pending: 'pending',
  rejected: 'rejected',
};

export default function HODOverview(): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ inside: 0, approvedToday: 0, pending: 0, rejectedToday: 0 });
  const [upcoming, setUpcoming] = useState<Visit[]>([]);
  const [pendingVisits, setPendingVisits] = useState<Visit[]>([]);
  const [onSite, setOnSite] = useState<Visit[]>([]);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep-linkable: arriving at /overview?filter=approved opens the pre-approved
  // list directly, which is how the pre-approval flow hands off to this page.
  const [activeFilter, setActiveFilter] = useState<FilterKey | ''>(
    () => FILTER_KEYS[searchParams.get('filter') ?? ''] ?? '',
  );
  const [filteredVisits, setFilteredVisits] = useState<Visit[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  // "More information" on a notification, same fix as OverviewUpcoming's
  // "Open details": a notification carries only `related_id`, so the visit it
  // points at has to be fetched on demand rather than navigated to blind.
  const [notifDetail, setNotifDetail] = useState<Visit | null>(null);

  const { acting, error: actionError, successMsg, reasons, onReasonChange, decide } = useVisitDecisions();

  // Scroll to the focused section when arriving via a sidebar panel link.
  useEffect(() => {
    const tab = searchParams.get('tab');
    const targetId = FOCUS_TABS[tab ?? ''] ?? null;
    if (!targetId) return;
    // Defer until paint so the section's layout is settled.
    const timer = window.setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      setUserId(uid);
      const jwtDeptId = (data.user?.app_metadata?.department_id as string) ?? '';
      const { data: profile } = await supabase.from('profiles').select('department_id').eq('id', uid).maybeSingle();
      // The department NAME is deliberately not fetched. It existed only for the
      // page header, and that header restated the one fact that never varies for
      // this user. The id still scopes every query below.
      setDeptId(jwtDeptId || (profile as any)?.department_id || null);
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

      // Pending walk-in requests, deliberately NOT bounded to today: a request
      // raised at 11pm is still someone waiting at the gate at 12:05am, and the
      // whole point of surfacing this on the Overview is that it is unfinished
      // business. The stats tile above stays day-bounded like every other tile.
      const { data: pendingData } = await supabase
        .from('visits').select('*, visitor:visitors(*), department:departments(id, name, code, created_at)')
        .eq('department_id', deptId).eq('status', 'pending_approval')
        .order('created_at', { ascending: false }).limit(50);
      let pendingRows = ((pendingData as unknown as Visit[]) ?? []);
      pendingRows = await attachHostNames(pendingRows);
      setPendingVisits(pendingRows.map(v => ({ ...v, photo_url: v.photo_data ?? undefined })));

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

      // Only today's arrivals. A visit that was checked in on an earlier day and
      // never checked out still carries status 'checked_in', so without the date
      // bound "On-site now" accumulates stale visitors from previous days.
      // Same UTC day boundary the stats and notifications queries above use.
      const { data: onSiteData } = await supabase
        .from('visits').select('*, visitor:visitors(*), department:departments(id, name, code, created_at)')
        .eq('department_id', deptId).in('status', ['checked_in'])
        .gte('checked_in_at', `${today}T00:00:00Z`)
        .order('checked_in_at', { ascending: false }).limit(20);
      let onSiteRows = ((onSiteData as unknown as Visit[]) ?? []);
      onSiteRows = await attachHostNames(onSiteRows);
      setOnSite(onSiteRows.map(v => ({ ...v, photo_url: v.photo_data ?? undefined })));

      await supabase.from('notifications').delete().lt('created_at', `${today}T00:00:00Z`);
      const { data: notifData } = await supabase
        .from('notifications').select('*').eq('recipient_id', userId)
        .gte('created_at', `${today}T00:00:00Z`)
        .order('created_at', { ascending: false }).limit(10);
      setNotifs((notifData ?? []) as Notification[]);
    } catch { /* dashboard is read-only and defensive */ }
    if (!silent) setLoading(false);
  }, [deptId, userId, today]);

  useEffect(() => { void load(); }, [load]);

  // Fetch filtered data when activeFilter changes
  const loadFiltered = useCallback(async (key: FilterKey) => {
    if (!deptId) return;
    setFilterLoading(true);
    try {
      const statuses: readonly VisitStatus[] =
        key === 'inside' ? ['checked_in']
        : key === 'approved' ? ['approved', 'walkin_approved']
        : key === 'pending' ? ['pending_approval']
        : ['rejected'];

      const { data } = await supabase
        .from('visits').select('*, visitor:visitors(*), department:departments(id, name, code, created_at)')
        .eq('department_id', deptId).in('status', statuses)
        .gte('created_at', `${today}T00:00:00Z`)
        .order('created_at', { ascending: false }).limit(50);
      let rows = ((data as unknown as Visit[]) ?? []);
      rows = await attachHostNames(rows);
      setFilteredVisits(rows.map(v => ({ ...v, photo_url: v.photo_data ?? undefined })));
    } catch { /* defensive */ }
    setFilterLoading(false);
  }, [deptId, today]);

  useEffect(() => {
    if (!deptId || !userId) return;
    const ch = supabase.channel('hod-overview-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits', filter: `department_id=eq.${deptId}` }, () => {
        void load(true);
        if (activeFilter) void loadFiltered(activeFilter);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [deptId, userId, load, activeFilter, loadFiltered]);

  // One fetch path for both a tile click and a ?filter= deep link, so a
  // deep-linked list is never left empty waiting on a click that already happened.
  useEffect(() => {
    if (!deptId || !activeFilter) return;
    void loadFiltered(activeFilter);
  }, [deptId, activeFilter, loadFiltered]);

  const handleFilterSelect = useCallback((key: string) => {
    const next = FILTER_KEYS[key] ?? '';
    setActiveFilter(next);
    // Keep the URL honest, so a refresh or a shared link reopens the same list.
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next) params.set('filter', next); else params.delete('filter');
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // `related_id` is a visit id for the visit-lifecycle notification types; for
  // the two gate-pass types it is a gate_pass id, which will simply not match
  // any row here — VMS has no gate-pass surface, so those notifications are
  // dead in practice and this resolves to nothing, silently, rather than
  // throwing or navigating anywhere.
  const openNotifDetail = async (relatedId: string) => {
    const { data } = await supabase
      .from('visits').select('*, visitor:visitors(*), department:departments(id, name, code, created_at)')
      .eq('id', relatedId).maybeSingle();
    if (!data) return;
    const rows = await attachHostNames([data as unknown as Visit]);
    const withHost = rows[0];
    if (!withHost) return;
    setNotifDetail({ ...withHost, photo_url: withHost.photo_data ?? undefined });
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };
  const dismiss = (id: string) => {
    void supabase.from('notifications').delete().eq('id', id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* No page header. An HOD belongs to exactly one department and every
          number on this page is already scoped to it, so "<Dept> Department"
          restated the one fact that never varies for this user. "Overview" is
          the nav item they just clicked. Both were pure repetition pushing the
          actual content down the page. The stat cards start the page instead. */}

      {successMsg && (
        <div className="alert-success">
          <svg className="w-4 h-4 text-success-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1">{successMsg}</span>
        </div>
      )}
      {actionError && (
        <div className="alert-error">
          <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span className="flex-1">{actionError}</span>
        </div>
      )}

      <OverviewStatCards loading={loading} stats={stats} activeFilter={activeFilter} onSelect={handleFilterSelect} />

      {activeFilter ? (
        <OverviewFilteredView
          mode={activeFilter as FilterKey}
          visits={filteredVisits}
          loading={filterLoading}
          onClearFilter={() => handleFilterSelect('')}
          acting={acting}
          reasons={reasons}
          onReasonChange={onReasonChange}
          onApprove={(id) => void decide(id, true)}
          onReject={(id) => void decide(id, false)}
        />
      ) : (
        <>
          {/* Above everything else: this is the only section on the page that
              someone is actively waiting on. */}
          <div id="hod-section-pending" className="scroll-mt-4">
          <OverviewPendingApprovals
            visits={pendingVisits}
            loading={loading}
            acting={acting}
            reasons={reasons}
            onReasonChange={onReasonChange}
            onDecide={(id, approved) => void decide(id, approved)}
          />
          </div>

          <OverviewOnSite loading={loading} onSite={onSite} />

          {notifDetail && (
            <VisitorDetails
              visit={notifDetail}
              viewerRole="hod"
              onClose={() => setNotifDetail(null)}
            />
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-3 items-start">
            <div id="hod-section-schedule" className="scroll-mt-4">
            <OverviewUpcoming loading={loading} upcoming={upcoming} />
            </div>
            <OverviewNotifications loading={loading} notifs={notifs} onMarkRead={markRead} onDismiss={dismiss} onOpenDetails={openNotifDetail} />
          </div>
        </>
      )}
    </div>
  );
}
