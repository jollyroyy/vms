import React, { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from './AdminPageHeader';
import AdminRangeBar from './AdminRangeBar';
import AdminSecurityKpis from './AdminSecurityKpis';
import AdminBlacklistPanel from './AdminBlacklistPanel';
import AdminSecurityAlertsPanel from './AdminSecurityAlertsPanel';
import AdminDeniedEntriesPanel from './AdminDeniedEntriesPanel';
import AdminWatchlistPanel from './AdminWatchlistPanel';
import AdminBlacklistForm from './AdminBlacklistForm';
import VisitorDetails from '../../components/VisitorDetails';
import { useAdminVisits } from '../../lib/useAdminVisits';
import { useVisitorDirectory } from '../../lib/useVisitorDirectory';
import { attachVisitActors } from '../../lib/visitActors';
import {
  blacklistedVisitors, deniedEntries, securityAlerts,
} from '../../lib/adminSecurity';
import type { ReportVisit } from '../../lib/reportRow';
import { istDateKey } from '../../lib/visitExpiry';
import { computeDateRange, type RangePreset } from '../../lib/reportsDateRange';

const SECURITY_LIMIT = 1000;

// The admin "Blacklist & Security" tab.
//
// THIS IS THE ONE ADMIN SCREEN THAT WRITES. Every other admin tab is
// read-only over visitor records (2026-08-17 scope, CLAUDE.md's Admin
// scope section); Blacklist Visitor is security administration on
// `visitors`, never a write to `visits` — no check-in, check-out, approve,
// reject or deny-entry control exists anywhere on this page.
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
  const [selected, setSelected] = useState<ReportVisit | null>(null);

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
        <AdminBlacklistPanel visitors={blacklisted} loading={visitorsLoading} />
        <AdminSecurityAlertsPanel alerts={alerts} loading={visitsLoading} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <AdminDeniedEntriesPanel rows={deniedRows} loading={visitsLoading} now={now} onOpen={setSelected} />
        <AdminWatchlistPanel />
      </div>

      {showForm && <AdminBlacklistForm onClose={() => setShowForm(false)} />}

      {selected && (
        <VisitorDetails visit={selected} viewerRole="admin" onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
