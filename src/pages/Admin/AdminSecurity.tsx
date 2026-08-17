import React, { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from './AdminPageHeader';
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
  blacklistedVisitors, deniedEntriesToday, securityAlertsToday,
} from '../../lib/adminSecurity';
import type { ReportVisit } from '../../lib/reportRow';

// The admin "Blacklist & Security" tab.
//
// THIS IS THE ONE ADMIN SCREEN THAT WRITES. Every other admin tab is
// read-only over visitor records (2026-08-17 scope, CLAUDE.md's Admin
// scope section); Blacklist Visitor is security administration on
// `visitors`, never a write to `visits` — no check-in, check-out, approve,
// reject or deny-entry control exists anywhere on this page.
//
// TWO QUERIES, EACH FEEDING ONE HALF OF THE SCREEN. `useAdminVisits({kind:
// 'today'})` is the visits window — it feeds Alerts Today, Denied Entries and
// the overstay half of Security Alerts. `useVisitorDirectory()` is the
// visitors table itself — it feeds Blacklisted and the Blacklist panel. They
// are different tables answering different questions, so unlike the admin
// Dashboard's single query this tab has two; each is still the ONLY source
// for the figures derived from it (lib/adminSecurity.ts), so a count and its
// panel can never disagree.
export default function AdminSecurity(): React.ReactElement {
  const now = useMemo(() => new Date(), []);
  const { visits, loading: visitsLoading } = useAdminVisits({ kind: 'today' });
  const { visitors, loading: visitorsLoading } = useVisitorDirectory();

  // `attachVisitActors` resolves WHO refused each row from the
  // `visit_rejected` audit log — the Denied Entries panel's whole reason for
  // existing is telling a guard's refusal apart from an HOD's decline, and
  // that name lives only in audit_logs, never on the visit row itself.
  const [deniedRows, setDeniedRows] = useState<ReportVisit[]>([]);
  useEffect(() => {
    const denied = deniedEntriesToday(visits, now);
    void attachVisitActors(denied).then((rows) => setDeniedRows(rows as ReportVisit[]));
  }, [visits, now]);

  const blacklisted = useMemo(() => blacklistedVisitors(visitors), [visitors]);
  const alerts = useMemo(() => securityAlertsToday(visits, now), [visits, now]);

  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<ReportVisit | null>(null);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <AdminPageHeader
        title="Blacklist & Security"
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

      <AdminSecurityKpis
        blacklisted={blacklisted.length}
        alertsToday={alerts.length}
        deniedToday={deniedRows.length}
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
