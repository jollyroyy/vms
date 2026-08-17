import React, { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from './AdminPageHeader';
import AdminRangeBar from './AdminRangeBar';
import AdminSecurityKpis from './AdminSecurityKpis';
import AdminBlacklistPanel from './AdminBlacklistPanel';
import AdminSecurityAlertsPanel from './AdminSecurityAlertsPanel';
import AdminDeniedEntriesPanel from './AdminDeniedEntriesPanel';
import AdminBlacklistForm from './AdminBlacklistForm';
import BlacklistRemovalForm from './BlacklistRemovalForm';
import BlacklistRemovalsPanel from './BlacklistRemovalsPanel';
import VisitorDetails from '../../components/VisitorDetails';
import { useAdminVisits } from '../../lib/useAdminVisits';
import { useVisitorDirectory } from '../../lib/useVisitorDirectory';
import { useBlacklistRemovals } from '../../lib/useBlacklistRemovals';
import { attachVisitActors } from '../../lib/visitActors';
import {
  blacklistedVisitors, deniedEntries, securityAlerts,
} from '../../lib/adminSecurity';
import type { ReportVisit } from '../../lib/reportRow';
import type { Visitor } from '../../types/index';
import { istDateKey } from '../../lib/visitExpiry';
import { computeDateRange, type RangePreset } from '../../lib/reportsDateRange';

const SECURITY_LIMIT = 1000;

// The admin "Blacklist & Security" tab.
//
// THIS IS THE ONE ADMIN SCREEN THAT WRITES, and it now writes TWO things.
// Every other admin tab is read-only over visitor records (2026-08-17 scope,
// CLAUDE.md's Admin scope section); both writes here are security
// administration on `visitors` and its removal queue, never a write to
// `visits` — no check-in, check-out, approve, reject or deny-entry control
// exists anywhere on this page.
//
// THE TWO WRITES ARE NOT SYMMETRICAL, and that asymmetry is the feature
// (client instruction, 2026-08-17). Blacklist Visitor is one admin's own call,
// because delaying a protective action behind an approval leaves somebody
// admissible who should not be. Request Removal is only an ASK: it files a
// justification for the CEO and touches nothing on the visitor. The clearance
// itself happens on the CEO's screen, and migration 092's trigger refuses it
// from every other caller — including a direct PostgREST PATCH by this very
// admin — so the second pair of eyes is a property of the database rather than
// of which buttons this page happens to render.
//
// THIS TAB IS A MIX OF LIVE STATE AND HISTORICAL STATE (client instruction,
// 2026-08-17), and getting that mix labelled honestly is the whole reason it
// looks the way it does below. `lib/adminSecurity.ts`'s header comment holds
// the full reasoning; the short version: Denied Entries and the blacklist
// half of Security Alerts are EVENTS that happened on a date, so they follow
// the range bar. The Blacklist roster and the overstay half of Security
// Alerts are facts about RIGHT NOW — who is flagged, who is still inside
// past their deadline — and ranging either would be meaningless, not merely
// unhelpful: `visitors` keeps no history of when a flag was set, and an
// overstay is by definition a this-instant fact.
//
// TWO QUERIES, EACH FEEDING ONE HALF OF THE SCREEN. `useAdminVisits({kind:
// 'range', ...})` is the ranged visits window — it feeds Denied Entries and
// the blacklist half of Security Alerts. `useVisitorDirectory()` is the
// visitors table itself — it feeds Blacklisted and the Blacklist panel, and is
// never touched by the range.
//
// `includeInside` IS WHAT MAKES THE LIVE HALF ACTUALLY LIVE. The overstay
// predicate carries no date test, but a predicate can only ever see the rows
// its query loaded — so without that flag, an admin who narrowed the range to
// a past day would read an empty Security Alerts panel while a visitor was
// overdue in the building right now. Telling somebody nobody is overstaying
// when somebody is, is the one failure this tab exists to prevent, and it is
// not the kind of gap a comment can discharge: the flag ORs every `checked_in`
// row into the fetch regardless of the dates, so the live half is complete at
// any range setting.
export default function AdminSecurity(): React.ReactElement {
  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => istDateKey(now), [now]);

  const [preset, setPreset] = useState<RangePreset>('30d');
  const [endDate, setEndDate] = useState<string>(today);
  const range = useMemo(() => computeDateRange(preset, endDate), [preset, endDate]);

  const { visits, loading: visitsLoading } = useAdminVisits({
    kind: 'range', from: range.from, to: range.to, limit: SECURITY_LIMIT,
    includeInside: true,
  });
  const { visitors, loading: visitorsLoading } = useVisitorDirectory();
  const { requests, loading: removalsLoading, reload: reloadRemovals } = useBlacklistRemovals();

  // `attachVisitActors` resolves WHO refused each row from the
  // `visit_rejected` audit log — the Denied Entries panel's whole reason for
  // existing is telling a guard's refusal apart from an HOD's decline, and
  // that name lives only in audit_logs, never on the visit row itself.
  const [deniedRows, setDeniedRows] = useState<ReportVisit[]>([]);
  useEffect(() => {
    const denied = deniedEntries(visits);
    void attachVisitActors(denied).then((rows) => setDeniedRows(rows as ReportVisit[]));
  }, [visits]);

  const blacklisted = useMemo(() => blacklistedVisitors(visitors), [visitors]);
  const alerts = useMemo(() => securityAlerts(visits, now), [visits, now]);

  const [showForm, setShowForm] = useState(false);
  const [removalFor, setRemovalFor] = useState<Visitor | null>(null);
  const [selected, setSelected] = useState<ReportVisit | null>(null);

  // Which blacklisted visitors already have a request waiting on the CEO. The
  // panel needs the SET rather than the list: it is asking a per-row question,
  // and migration 091's unique index means a second open request on the same
  // visitor cannot exist, so offering the button there could only produce an
  // error nobody could act on.
  const awaitingCeo = useMemo(
    () => new Set(requests.filter((r) => r.status === 'pending').map((r) => r.visitor_id)),
    [requests],
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <AdminPageHeader
        title="Blacklist & Security"
        scope="historical"
        action={(
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="bg-danger-600 hover:bg-danger-700 text-white font-bold rounded-xl px-4 py-2 text-sm transition-all"
          >
            + Blacklist Visitor
          </button>
        )}
      />

      <AdminRangeBar
        preset={preset}
        endDate={endDate}
        today={today}
        onPresetChange={setPreset}
        onEndDateChange={setEndDate}
        noun="security events"
      />

      <AdminSecurityKpis
        blacklisted={blacklisted.length}
        alerts={alerts.length}
        denied={deniedRows.length}
        loading={visitsLoading || visitorsLoading}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
        <AdminBlacklistPanel
          visitors={blacklisted}
          loading={visitorsLoading}
          awaitingCeo={awaitingCeo}
          onRequestRemoval={setRemovalFor}
        />
        <AdminSecurityAlertsPanel alerts={alerts} loading={visitsLoading} />
      </div>

      {/* Denied Entries, FULL WIDTH. There is no Watchlist panel beside it any
          more (deleted 2026-08-18, client instruction). It could never render a
          row — no watchlist table exists in this schema, which is why the
          guard's Watchlist tab went on 2026-08-15 — so all it ever did was
          occupy half a row to say that the panel above it is the whole story.
          Being honest about an empty panel is better than faking one, but not
          rendering it at all is better still: a heading with no data behind it
          reads as a feature that is broken today rather than one that does not
          exist. If a real watchlist is ever added, it needs a table first. */}
      <AdminDeniedEntriesPanel rows={deniedRows} loading={visitsLoading} now={now} onOpen={setSelected} />

      {/* FULL WIDTH, BELOW BOTH GRIDS. A removal request is the one thing on
          this tab that is still in motion — it is waiting on somebody outside
          the admin's own console — and its justification and the CEO's note
          are prose, not cells, so a half-width column would wrap both into
          columns of four words. */}
      <div className="mt-5">
        <BlacklistRemovalsPanel requests={requests} loading={removalsLoading} />
      </div>

      {showForm && <AdminBlacklistForm onClose={() => setShowForm(false)} />}

      {removalFor && (
        <BlacklistRemovalForm
          visitor={removalFor}
          onClose={() => setRemovalFor(null)}
          onFiled={() => { void reloadRemovals(); }}
        />
      )}

      {selected && (
        <VisitorDetails visit={selected} viewerRole="admin" onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
