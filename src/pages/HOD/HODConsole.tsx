/**
 * The HOD's decision workspace — the dashboard, the walk-in desk and the
 * visitor schedule, all as `?tab=` views of /overview.
 *
 * IT IS DRAWN IN THE GUARD'S DESIGN, AND THAT IS THE POINT (client instruction,
 * 2026-08-16: "make the look and feel, font type and typography of the HOD view
 * exactly same as guard's view, so they should not look different style wise,
 * since they are part of same /vms app"). Every tile is
 * components/DashboardTile, every list is components/DashboardVisitorTable and
 * every card is components/DashboardPanel — the same files the guard dashboard
 * renders, not lookalikes. `styles/hod-compact.css` is DELETED: it was a
 * self-contained 8-to-11px type scale with its own accent hue, which is what
 * made an HOD moving between this screen and any other in /vms feel they had
 * changed application. Do not reintroduce a stylesheet scoped to one role.
 *
 * THERE IS NO APPROVAL DESK (removed 2026-08-16, same instruction). It listed
 * `pending_approval` rows carrying a `scheduled_for`, and no such row exists:
 * WalkInRequest and the kiosk are the only writers of that status and both
 * insert `scheduled_for: null`, while a pre-approval is created already
 * approved. `?tab=preapprovals` degrades onto the dashboard rather than
 * 404-ing — it is in bookmarks — and /approvals is still the pre-approval FORM.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import type { ReportVisit } from '../../lib/reportRow';
import { attachHostNames } from '../../lib/hostNames';
import { usePreApprovals } from '../../lib/usePreApprovals';
import { istDayStart } from '../../lib/visitExpiry';
import { useVisitDecisions } from './useVisitDecisions';
import { hodTileVisits, type HodTileKey } from '../../lib/hodTiles';
import HodKpiBoard from './HodKpiBoard';
import OverstayAlertBanner from '../../components/OverstayAlertBanner';
import HodWalkInDesk from './HodWalkInDesk';
import HodSchedule from './HodSchedule';
import VisitorDetails from '../../components/VisitorDetails';

type ConsoleTab = 'overview' | 'walkins' | 'schedule';

const tabFromLocation = (search: string): ConsoleTab => {
  const requested = new URLSearchParams(search).get('tab');
  // `preapprovals` is deliberately absent from this list, so the deleted desk's
  // bookmarks land on the dashboard instead of a blank tab.
  if (requested === 'walkins' || requested === 'schedule') return requested;
  return 'overview';
};

const initialsOf = (name: string | null | undefined): string =>
  ((name ?? 'U').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U');

const SELECT = '*, visitor:visitors(*), department:departments(id, name, code, created_at)';

export default function HODConsole(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = useMemo(() => tabFromLocation(location.search), [location.search]);
  const [deptId, setDeptId] = useState<string | null>(null);
  // Today's department visits, FULL ROWS — the counts are list lengths, so the
  // board must hold the rows it is counting (lib/hodTiles.ts).
  const [dayVisits, setDayVisits] = useState<Visit[]>([]);
  const [openTile, setOpenTile] = useState<HodTileKey>('pending');
  const [walkIns, setWalkIns] = useState<Visit[]>([]);
  const [onSite, setOnSite] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(() => new Date());
  const [selectedWalkInId, setSelectedWalkInId] = useState<string | null>(null);
  const [detailVisit, setDetailVisit] = useState<ReportVisit | null>(null);
  const { visits: approvedToday } = usePreApprovals('today');
  const { visits: approvedUpcoming } = usePreApprovals('upcoming');
  const { acting, error, successMsg, reasons, onReasonChange, decide } = useVisitDecisions();

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

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
    // IST midnight. `${utcDateKey}T00:00:00Z` is 05:30 IST, so the board's
    // day query and its on-site lane both began five and a half hours late and
    // an HOD's early arrivals were absent from their own department's screen.
    const dayStart = istDayStart().toISOString();
    try {
      const [todayResult, walkInResult, onSiteResult] = await Promise.all([
        // CREATED, ARRIVED **OR** DEPARTED TODAY — three clauses, not one.
        //
        // It was `created_at >= dayStart` alone, which is the wrong window for
        // the two tiles added on 2026-08-17 and was already the wrong window
        // for the charts' arrival counts. A pre-approval raised last week whose
        // visitor walked in this morning was NOT created today, so the HOD's
        // own booking vanished from their own board on the one day it mattered;
        // and a visitor who arrived at 21:00 yesterday and left after midnight
        // was neither created nor arrived today, so the departure most likely
        // to be asked about was exactly the row that was missing. This is the
        // same widening `useTodayVisits` and `useAdminVisits` already carry —
        // the rule is stated in three places now and was being retyped wrong in
        // a fourth.
        supabase.from('visits').select(SELECT).eq('department_id', deptId)
          .or(`created_at.gte.${dayStart},checked_in_at.gte.${dayStart},checked_out_at.gte.${dayStart}`)
          .order('created_at', { ascending: false }).limit(200),
        // NOT day-bounded: a request raised at 11pm is still someone standing at
        // reception at 12:05am.
        supabase.from('visits').select(SELECT).eq('department_id', deptId).eq('status', 'pending_approval').order('created_at', { ascending: false }).limit(50),
        // NOT day-bounded either, and for the reason the guard board's `inside`
        // predicate is `status === 'checked_in'` and nothing else: this is the
        // list you hand a fire marshal. A contractor who arrived at 21:00
        // yesterday and has not left is on the premises now, and the old
        // `checked_in_at >= dayStart` clause dropped them off the tile at
        // midnight while they were still in the building — the one direction
        // this figure must never be wrong in. The limit is raised with the
        // bound removed so a genuinely busy department cannot silently truncate.
        supabase.from('visits').select(SELECT).eq('department_id', deptId).eq('status', 'checked_in').order('checked_in_at', { ascending: false }).limit(100),
      ]);
      const [nextDay, nextWalkIns, nextOnSite] = await Promise.all([
        normaliseRows(todayResult.data as unknown as Visit[] | null),
        normaliseRows(walkInResult.data as unknown as Visit[] | null),
        normaliseRows(onSiteResult.data as unknown as Visit[] | null),
      ]);
      setDayVisits(nextDay);
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
  useEffect(() => {
    setSelectedWalkInId((current) => (walkIns.some((visit) => visit.id === current) ? current : (walkIns[0]?.id ?? null)));
  }, [walkIns]);

  // Soonest first — a list of people still to arrive is read forwards.
  const approvedAppointments = useMemo(() => {
    const unique = new Map<string, Visit>();
    [...approvedToday, ...approvedUpcoming].forEach((visit) => unique.set(visit.id, visit));
    return Array.from(unique.values()).sort(
      (a, b) => new Date(a.scheduled_for ?? a.created_at).getTime() - new Date(b.scheduled_for ?? b.created_at).getTime(),
    );
  }, [approvedToday, approvedUpcoming]);
  const selectedWalkIn = walkIns.find((visit) => visit.id === selectedWalkInId) ?? null;
  // ONE source for every KPI: the count is the length of the list the tile
  // opens, and the desk below acts on those same rows.
  const tiles = useMemo(
    () => hodTileVisits({ day: dayVisits, onSite, walkIns }, clock),
    [dayVisits, onSite, walkIns, clock],
  );

  const runDecision = (approved: boolean) => {
    if (!selectedWalkIn) return;
    void decide(selectedWalkIn.id, approved).then(() => { void load(true); });
  };

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {successMsg && <div className="alert-success">{successMsg}</div>}
      {error && <div className="alert-error">{error}</div>}

      {/* THIS DEPARTMENT'S OVERDUE VISITORS, IN RED, ABOVE THE TILES (client
          instruction, 2026-08-18). Fed from `onSite` — the department's
          checked-in rows, whose query is deliberately NOT date-bounded, so a
          contractor still inside from yesterday is exactly who this catches.
          The same `isOverstaying` the guard's board and the admin's use; an
          HOD chasing a visitor and a guard chasing the same one must be
          looking at the same list. */}
      {tab === 'overview' && <OverstayAlertBanner visits={onSite} now={clock} />}

      {tab === 'overview' && (
        <HodKpiBoard
          tiles={tiles}
          dayVisits={dayVisits}
          selected={openTile}
          onSelect={setOpenTile}
          loading={loading}
          now={clock}
          initialsOf={initialsOf}
          onOpen={setDetailVisit}
        />
      )}

      {tab === 'walkins' && (
        <HodWalkInDesk
          walkIns={walkIns}
          loading={loading}
          now={clock}
          initialsOf={initialsOf}
          selected={selectedWalkIn}
          onSelect={setSelectedWalkInId}
          reason={selectedWalkIn ? (reasons[selectedWalkIn.id] ?? '') : ''}
          onReasonChange={(value) => { if (selectedWalkIn) onReasonChange(selectedWalkIn.id, value); }}
          acting={acting === selectedWalkIn?.id}
          onDecide={runDecision}
        />
      )}

      {tab === 'schedule' && (
        <HodSchedule
          visits={approvedAppointments}
          onSiteCount={onSite.length}
          approvedTodayCount={approvedToday.length}
          loading={loading}
          now={clock}
          initialsOf={initialsOf}
          onOpen={setDetailVisit}
        />
      )}

      {/* The HOD never sees a visitor's ID proof — VisitorDetails hides the row
          for this viewer role. An approver decides on who is visiting and why;
          matching a document to a face is the gate's job. */}
      {detailVisit && (
        <VisitorDetails visit={detailVisit} viewerRole="hod" onClose={() => setDetailVisit(null)} />
      )}

      {/* `navigate` keeps the console's one shortcut out of content: the
          dashboard's pending tile is a lane, not a destination, so an HOD who
          wants to act on it still has to reach the desk. */}
      {tab === 'overview' && tiles.pending.length > 0 && (
        <button
          type="button"
          onClick={() => navigate('/overview?tab=walkins')}
          className="w-full rounded-2xl border border-brand-500/40 bg-brand-600/10 dark:bg-brand-500/15 px-5 py-4 text-left text-sm font-semibold text-brand-600 dark:text-brand-400 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow">
          {tiles.pending.length} walk-in{tiles.pending.length === 1 ? '' : 's'} waiting at reception — open the desk ›
        </button>
      )}
    </div>
  );
}
