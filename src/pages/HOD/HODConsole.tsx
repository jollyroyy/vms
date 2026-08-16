/**
 * HOD Console visual philosophy: compact dark-navy operations workspace.
 * The original BMS Sidebar remains the only application navigation; this
 * component renders the right-side decision content only.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { usePreApprovals } from '../../lib/usePreApprovals';
import { useVisitDecisions } from './useVisitDecisions';
import '../../styles/hod-compact.css';

type ConsoleTab = 'overview' | 'preapprovals' | 'walkins' | 'schedule';
type Stats = { inside: number; approvedToday: number; pending: number; rejectedToday: number; };

const EMPTY_STATS: Stats = { inside: 0, approvedToday: 0, pending: 0, rejectedToday: 0 };
// EVERY TAB HANGS OFF /overview. `preapprovals` used to be `/approvals`, which
// is now the pre-approval FORM again (App.tsx) — the one HOD screen that raises
// a visitor pass rather than deciding one. Two different surfaces cannot share a
// URL, and of the two the form is the one an HOD has no other route to.
const tabHref: Record<ConsoleTab, string> = {
  overview: '/overview',
  preapprovals: '/overview?tab=preapprovals',
  walkins: '/overview?tab=walkins',
  schedule: '/overview?tab=schedule',
};

const tabFromLocation = (_pathname: string, search: string): ConsoleTab => {
  const requested = new URLSearchParams(search).get('tab');
  if (requested === 'overview' || requested === 'preapprovals' || requested === 'walkins' || requested === 'schedule') return requested;
  return 'overview';
};

const display = (value: string | null | undefined, options: Intl.DateTimeFormatOptions): string => {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not set' : new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...options }).format(date);
};
const visitTime = (visit: Visit): string => display(visit.scheduled_for ?? visit.created_at, { hour: '2-digit', minute: '2-digit', hour12: false });
const visitDay = (visit: Visit): string => display(visit.scheduled_for ?? visit.created_at, { weekday: 'long', month: 'short', day: 'numeric' });
const visitorName = (visit: Visit): string => visit.visitor?.full_name || 'Unnamed visitor';
const visitorCompany = (visit: Visit): string => visit.visitor?.vendor_name || 'Independent visitor';
const hostName = (visit: Visit): string => visit.host?.full_name || 'Host to be confirmed';
const purposeLabel = (visit: Visit): string => visit.purpose.replace(/_/g, ' ');

function Avatar({ name, tone = 0 }: { name: string; tone?: number }): React.ReactElement {
  const initials = name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';
  return <span className={`hod-avatar hod-avatar--${tone % 4}`}>{initials}</span>;
}

function StatusBadge({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'green' | 'amber' | 'slate' }): React.ReactElement {
  return <span className={`hod-badge hod-badge--${tone}`}>{children}</span>;
}

function EmptyState({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="hod-empty">{children}</div>;
}

export default function HODConsole(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = useMemo(() => tabFromLocation(location.pathname, location.search), [location.pathname, location.search]);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [scheduledDecisions, setScheduledDecisions] = useState<Visit[]>([]);
  const [walkIns, setWalkIns] = useState<Visit[]>([]);
  const [onSite, setOnSite] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScheduledId, setSelectedScheduledId] = useState<string | null>(null);
  const [selectedWalkInId, setSelectedWalkInId] = useState<string | null>(null);
  const { visits: approvedToday } = usePreApprovals('today');
  const { visits: approvedUpcoming } = usePreApprovals('upcoming');
  const { acting, error, successMsg, reasons, onReasonChange, decide } = useVisitDecisions();

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user || !mounted) return;
      const metadataDepartmentId = data.user.app_metadata?.department_id as string | undefined;
      const { data: profile } = await supabase.from('profiles').select('department_id').eq('id', data.user.id).maybeSingle();
      if (mounted) setDeptId(metadataDepartmentId || (profile as { department_id?: string | null } | null)?.department_id || null);
    });
    return () => { mounted = false; };
  }, []);

  const normaliseRows = useCallback(async (rows: Visit[] | null | undefined): Promise<Visit[]> => {
    const resolved = await attachHostNames(rows ?? []);
    return resolved.map((visit) => ({ ...visit, photo_url: visit.photo_data ?? undefined }));
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!deptId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    try {
      const [todayResult, scheduledResult, walkInResult, onSiteResult] = await Promise.all([
        supabase.from('visits').select('id, status').eq('department_id', deptId).gte('created_at', `${today}T00:00:00Z`),
        supabase.from('visits').select('*, visitor:visitors(*), department:departments(id, name, code, created_at)').eq('department_id', deptId).eq('status', 'pending_approval').not('scheduled_for', 'is', null).order('scheduled_for', { ascending: true }).limit(50),
        supabase.from('visits').select('*, visitor:visitors(*), department:departments(id, name, code, created_at)').eq('department_id', deptId).eq('status', 'pending_approval').is('scheduled_for', null).order('created_at', { ascending: false }).limit(50),
        supabase.from('visits').select('*, visitor:visitors(*), department:departments(id, name, code, created_at)').eq('department_id', deptId).eq('status', 'checked_in').gte('checked_in_at', `${today}T00:00:00Z`).order('checked_in_at', { ascending: false }).limit(20),
      ]);
      const dayRows = (todayResult.data ?? []) as Array<{ status: string }>;
      setStats({
        inside: dayRows.filter((row) => row.status === 'checked_in').length,
        approvedToday: dayRows.filter((row) => row.status === 'approved' || row.status === 'walkin_approved').length,
        pending: dayRows.filter((row) => row.status === 'pending_approval').length,
        rejectedToday: dayRows.filter((row) => row.status === 'rejected').length,
      });
      const [nextScheduled, nextWalkIns, nextOnSite] = await Promise.all([
        normaliseRows(scheduledResult.data as unknown as Visit[] | null),
        normaliseRows(walkInResult.data as unknown as Visit[] | null),
        normaliseRows(onSiteResult.data as unknown as Visit[] | null),
      ]);
      setScheduledDecisions(nextScheduled);
      setWalkIns(nextWalkIns);
      setOnSite(nextOnSite);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [deptId, normaliseRows]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!deptId) return;
    const channel = supabase.channel('hod-console-live').on('postgres_changes', { event: '*', schema: 'public', table: 'visits', filter: `department_id=eq.${deptId}` }, () => { void load(true); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [deptId, load]);
  useEffect(() => { setSelectedScheduledId((current) => scheduledDecisions.some((visit) => visit.id === current) ? current : (scheduledDecisions[0]?.id ?? null)); }, [scheduledDecisions]);
  useEffect(() => { setSelectedWalkInId((current) => walkIns.some((visit) => visit.id === current) ? current : (walkIns[0]?.id ?? null)); }, [walkIns]);

  const approvedAppointments = useMemo(() => {
    const unique = new Map<string, Visit>();
    [...approvedToday, ...approvedUpcoming].forEach((visit) => unique.set(visit.id, visit));
    return Array.from(unique.values()).sort((a, b) => new Date(a.scheduled_for ?? a.created_at).getTime() - new Date(b.scheduled_for ?? b.created_at).getTime());
  }, [approvedToday, approvedUpcoming]);
  const selectedScheduled = scheduledDecisions.find((visit) => visit.id === selectedScheduledId) ?? null;
  const selectedWalkIn = walkIns.find((visit) => visit.id === selectedWalkInId) ?? null;
  const coveredAppointments = useMemo(() => [...scheduledDecisions, ...approvedToday], [scheduledDecisions, approvedToday]);
  const hostsConfirmed = coveredAppointments.filter((visit) => Boolean(visit.host?.full_name)).length;
  const liveHostsReached = walkIns.filter((visit) => Boolean(visit.host?.full_name)).length;
  const go = (next: ConsoleTab) => navigate(tabHref[next]);
  const runDecision = (visit: Visit, approved: boolean) => { void decide(visit.id, approved).then(() => { void load(true); }); };

  const decisionPanel = (visit: Visit | null, mode: 'scheduled' | 'walkin'): React.ReactElement => {
    if (!visit) return <aside className="hod-decision-card"><span className="hod-kicker">{mode === 'scheduled' ? 'FINAL SCHEDULED DECISION' : 'WALK-IN CLEARANCE'}</span><EmptyState>No live request is awaiting a final HOD decision.</EmptyState></aside>;
    const isActing = acting === visit.id;
    return <aside className="hod-decision-card">
      <div className="hod-decision-card__top"><span className="hod-kicker">{mode === 'scheduled' ? 'FINAL SCHEDULED DECISION' : 'WALK-IN CLEARANCE'}</span><StatusBadge tone="amber">Awaiting decision</StatusBadge></div>
      <h2>{visitorName(visit)}</h2><p>{visitorCompany(visit)} · {visit.scheduled_for ? `${visitTime(visit)} arrival` : 'Arrival recorded at reception'}</p>
      <div className="hod-details"><div><small>HOST</small><b>{hostName(visit)}</b></div><div><small>PURPOSE</small><b>{purposeLabel(visit)}</b></div><div><small>{mode === 'scheduled' ? 'VISIT WINDOW' : 'RECEPTION NOTE'}</small><b>{mode === 'scheduled' ? visitDay(visit) : (visit.remarks || 'Identity and reception details are on record')}</b></div></div>
      <label className="hod-reason"><span>Rejection reason <em>required to decline</em></span><input value={reasons[visit.id] ?? ''} onChange={(event) => onReasonChange(visit.id, event.target.value)} placeholder="State the reason if declining" /></label>
      <p className="hod-final-note">Your HOD decision is final. {mode === 'scheduled' ? 'Approval clears this guest for check-in.' : 'Clear entry creates the visitor’s active approval.'}</p>
      <div className="hod-actions"><button type="button" className="hod-action hod-action--secondary" onClick={() => runDecision(visit, false)} disabled={isActing}>Decline{mode === 'walkin' ? ' entry' : ''}</button><button type="button" className="hod-action" onClick={() => runDecision(visit, true)} disabled={isActing}>{isActing ? 'Saving…' : mode === 'walkin' ? 'Clear entry ›' : 'Approve visit ›'}</button></div>
    </aside>;
  };

  // THERE IS NO TAB BAR HERE (removed 2026-08-15, client report). A `.hod-tabs`
  // row sat across the top of this console listing Overview / Pre-approval desk
  // / Walk-in desk / Visitor schedule — a second navigation, on the same screen
  // as the sidebar that lists the same destinations, with nothing saying which
  // was authoritative. All four now live in the one left-hand panel
  // (components/layout/navLinks.tsx). `go()` stays: the Decision Pulse and the
  // reception alert below still move the HOD between desks, and those are
  // shortcuts out of content rather than a navigation bar.

  return <div className="hod-console"><div className="hod-content">
    {successMsg && <div className="hod-notice hod-notice--success">{successMsg}</div>}{error && <div className="hod-notice hod-notice--error">{error}</div>}
    {tab === 'overview' && <><header className="hod-page-title"><p>HOD COMMAND VIEW</p><h1>Department overview</h1></header><section className="hod-metrics" aria-busy={loading}><article className="hod-stat"><span className="hod-stat__icon">▣</span><span><small>On-site now</small><strong>{stats.inside}</strong><em>Checked in today</em></span></article><article className="hod-stat hod-stat--green"><span className="hod-stat__icon">✓</span><span><small>Approvals today</small><strong>{stats.approvedToday}</strong><em>Final decisions cleared</em></span></article><article className="hod-stat"><span className="hod-stat__icon">▧</span><span><small>Awaiting decision</small><strong>{stats.pending}</strong><em>Live visit requests</em></span></article><article className="hod-stat hod-stat--amber"><span className="hod-stat__icon">⌂</span><span><small>Walk-ins live</small><strong>{walkIns.length}</strong><em>Reception arrivals</em></span></article></section><section className="hod-two-col"><article className="hod-card hod-card--pulse"><div className="hod-card__head"><span>◷ &nbsp; DECISION PULSE</span><button type="button" onClick={() => go(scheduledDecisions.length ? 'preapprovals' : 'walkins')}>Open desk&nbsp; ›</button></div><h2>What needs your attention</h2>{[...scheduledDecisions, ...walkIns].slice(0, 5).map((visit) => <div className="hod-pulse-row" key={visit.id}><time>{visitTime(visit)}<b>{visit.scheduled_for ? 'Scheduled' : 'Walk-in'}</b></time><p><strong>{visitorName(visit)}</strong><small>{purposeLabel(visit)} · {hostName(visit)}</small></p><StatusBadge tone={visit.scheduled_for ? 'blue' : 'amber'}>{visit.scheduled_for ? 'Scheduled' : 'Walk-in'}</StatusBadge></div>)}{!loading && scheduledDecisions.length + walkIns.length === 0 && <EmptyState>No visitor decisions are waiting.</EmptyState>}</article><div className="hod-support-stack"><article className="hod-card hod-card--coverage"><span className="hod-kicker">♧ &nbsp; HOST COVERAGE</span><h2>Live host coverage</h2><p>Coverage is calculated from the visits currently in this department’s decision workspace.</p><div><small>Scheduled hosts confirmed</small><b>{hostsConfirmed} / {coveredAppointments.length}</b></div><div><small>Walk-in hosts reached</small><b>{liveHostsReached} / {walkIns.length}</b></div></article><button type="button" className="hod-alert" onClick={() => go('walkins')}>⚠ &nbsp; {walkIns.length ? `${walkIns.length} walk-in${walkIns.length === 1 ? '' : 's'} waiting at reception` : 'No walk-ins waiting at reception'} <b>›</b></button></div></section></>}
    {tab === 'preapprovals' && <><header className="hod-page-title"><p>SCHEDULED VISITS ONLY</p><h1>Pre-approval desk</h1></header><section className="hod-approval-grid"><article className="hod-card hod-card--table"><div className="hod-segments"><button type="button" className="is-selected">Awaiting review <b>{scheduledDecisions.length}</b></button></div><div className="hod-table-head"><span>ARRIVAL</span><span>VISITOR</span><span>HOST</span><span>PURPOSE</span><span>FINAL ACTION</span></div>{scheduledDecisions.map((visit, index) => <div className={`hod-table-row ${visit.id === selectedScheduledId ? 'is-selected' : ''}`} key={visit.id}><time>{visitTime(visit)}</time><div className="hod-visitor"><Avatar name={visitorName(visit)} tone={index} /><p><b>{visitorName(visit)}</b><small>{visitorCompany(visit)}</small></p></div><span>{hostName(visit)}</span><span>{purposeLabel(visit)}</span><button type="button" onClick={() => setSelectedScheduledId(visit.id)}>Review&nbsp; ›</button></div>)}{!loading && scheduledDecisions.length === 0 && <EmptyState>No scheduled visits currently need approval.</EmptyState>}</article>{decisionPanel(selectedScheduled, 'scheduled')}</section></>}
    {tab === 'walkins' && <><header className="hod-page-title"><p>LIVE RECEPTION REQUESTS</p><h1>Walk-in desk</h1></header><section className="hod-walkin-layout"><article className="hod-card hod-card--walkins"><div className="hod-card__head"><span>⌂ &nbsp; ARRIVALS WAITING FOR YOU</span><StatusBadge tone="amber">{walkIns.length} live</StatusBadge></div>{walkIns.map((visit, index) => <div className={`hod-walkin-row ${visit.id === selectedWalkInId ? 'is-selected' : ''}`} key={visit.id}><Avatar name={visitorName(visit)} tone={index} /><p><strong>{visitorName(visit)}</strong><small>{visitorCompany(visit)} · {purposeLabel(visit)}</small><em>{hostName(visit)} · received {visitTime(visit)}</em></p><time>{visitTime(visit)}</time><button type="button" onClick={() => setSelectedWalkInId(visit.id)}>Review&nbsp; ›</button></div>)}{!loading && walkIns.length === 0 && <EmptyState>No walk-in requests are waiting at reception.</EmptyState>}</article>{decisionPanel(selectedWalkIn, 'walkin')}</section></>}
    {tab === 'schedule' && <><header className="hod-page-title"><p>APPROVED & EXPECTED VISITS</p><h1>Visitor schedule</h1></header><section className="hod-schedule-grid"><article className="hod-card hod-card--schedule"><div className="hod-card__head"><span>▣ &nbsp; {display(new Date().toISOString(), { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}</span><b className="hod-today">Today</b></div>{approvedAppointments.map((visit) => <div className="hod-schedule-row" key={visit.id}><time>{visitTime(visit)}</time><i className={visit.status === 'approved' ? 'is-approved' : ''}></i><p><strong>{visitorName(visit)}</strong><small>{visitorCompany(visit)} · {purposeLabel(visit)}</small></p><StatusBadge tone="green">Approved</StatusBadge></div>)}{approvedAppointments.length === 0 && <EmptyState>No approved appointments are scheduled in the current horizon.</EmptyState>}</article><aside className="hod-card hod-card--glance"><span className="hod-kicker">▧ &nbsp; TODAY AT A GLANCE</span><div><small>Approved appointments</small><b>{approvedToday.length}</b></div><div><small>On-site visitors</small><b>{onSite.length}</b></div><div><small>Hosts confirmed</small><b>{hostsConfirmed} / {coveredAppointments.length}</b></div><hr/><p>Schedule is read-only. Final decisions are made in the relevant approval desk.</p></aside></section></>}
  </div></div>;
}
