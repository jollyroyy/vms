import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminPageHeader from './AdminPageHeader';
import AdminKpiTile from '../../components/AdminKpiTile';
import ChartCard from '../../components/charts/ChartCard';
import UtilizationRows from '../../components/charts/UtilizationRows';
import HostDirectoryCard from './HostDirectoryCard';
import HostNotificationsPanel from './HostNotificationsPanel';
import { useAdminVisits } from '../../lib/useAdminVisits';
import { useHods } from '../../lib/useHods';
import { useDepartments } from '../../lib/useDepartments';
import { hostKpis, hostDirectory, departmentSummary } from '../../lib/adminHosts';
import { istDateKey } from '../../lib/visitExpiry';
import { loadSettings, saveSettings } from '../../lib/appSettings';
import type { SettingKey, SettingsMap } from '../../lib/appSettings';
import { supabase } from '../../supabaseClient';
import { ICON_PEOPLE, ICON_CHECK_CIRCLE, ICON_LIST } from '../../lib/tileIcons';

// The admin Hosts tab: who receives visitors, how many they received this
// week, and the two settings that shape what a host is told about it.
//
// NO "ADD HOST" BUTTON. Host/HOD administration already exists in Settings →
// Roles & Users (the Admin Panel embedded there) — a second create-a-host
// control on this screen would be a second place to do the one thing, and the
// two would drift the moment either one grew a validation rule the other
// lacked. The header instead links straight to that section.
//
// A "HOST" IS THE UNION OF `useHods()` AND EVERY `host_id` ON A FETCHED
// VISIT — see `lib/adminHosts.ts`. The window is the trailing 7 IST days,
// fetched once via `useAdminVisits` and sliced by three pure functions, so
// the three KPI tiles, the directory grid and the department panel can never
// disagree about who counts or what "this week" means.
//
// IT IS **LIVE**, NOT HISTORICAL (client instruction, 2026-08-17: remove the
// Historical chip, "it should always reflect latest state"). The claim is true
// by construction rather than by label: `useAdminVisits` subscribes to
// `postgres_changes` on `visits` and reloads silently, so a visitor checked in
// at the gate right now lands on this board without a refresh. The trailing
// window ROLLS with the IST day for the same reason — `now` was frozen at mount,
// so a console left open overnight went on reporting yesterday's seven days
// under a chip promising the latest state.
//
// THIS TAB WRITES NOTHING TO `visits`. The three toggles at the bottom
// persist to `app_settings`, which is configuration, not a visitor record —
// the admin surface's read-only rule is about the gate's data, not about
// whether the admin can turn a notification on.

export default function AdminHosts(): React.ReactElement {
  // Ticking the IST date key rather than the clock: React bails out of a state
  // set to an identical string, so this re-renders once at midnight and never
  // on the other 1,439 minutes. Keying `now` off it is what makes the seven-day
  // window follow the day instead of the mount.
  const [dayKey, setDayKey] = useState(() => istDateKey(new Date()));
  useEffect(() => {
    const t = setInterval(() => setDayKey(istDateKey(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);

  const now = useMemo(() => new Date(), [dayKey]);
  const from = istDateKey(new Date(now.getTime() - 6 * 86_400_000));
  const to = dayKey;

  const { visits, loading: visitsLoading } = useAdminVisits({ kind: 'range', from, to });
  const { hods, loading: hodsLoading } = useHods();
  const { departments } = useDepartments();

  const kpis = useMemo(() => hostKpis(hods, visits, now), [hods, visits, now]);
  const directory = useMemo(
    () => hostDirectory(hods, departments, visits, now),
    [hods, departments, visits, now],
  );
  const deptRows = useMemo(() => departmentSummary(visits, now), [visits, now]);

  const loading = visitsLoading || hodsLoading;

  // Settings: loaded once, saved one key at a time. Errors resolve to
  // whatever was already on screen — a failed write must not silently flip a
  // switch back without saying so, so the state is only updated once the
  // write itself confirms.
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState<SettingKey | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const onToggle = useCallback(async (key: SettingKey, next: boolean) => {
    if (!settings) return;
    setSaving(key);
    const { error } = await saveSettings({ [key]: next } as Partial<SettingsMap>, userId);
    if (!error) setSettings({ ...settings, [key]: next });
    setSaving(null);
  }, [settings, userId]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* LIVE, WITH NO RANGE PICKER — the window is the trailing 7 IST days
          ending TODAY, and it rolls (see above), so the board always reads the
          latest state. The blurb still states the period in words: the chip
          says the data is current, not how far back it reaches, and an admin
          reading "Visitors This Week" would otherwise have no way to know
          which seven days that is. */}
      <AdminPageHeader
        title="Hosts"
        scope="live"
        blurb="Everyone visitors are checked in against, over the last 7 days, and what they're told when one arrives."
        action={
          <Link to="/admin/settings?section=users" className="btn-secondary !px-4 !py-2 text-sm">
            Manage in Settings
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <AdminKpiTile
          label="Total Hosts"
          value={String(kpis.totalHosts)}
          icon={ICON_PEOPLE}
          tone="brand"
          loading={loading}
          caption="Distinct people visitors can be checked in against"
        />
        <AdminKpiTile
          label="Visitors This Week"
          value={String(kpis.visitorsThisWeek)}
          icon={ICON_CHECK_CIRCLE}
          tone="brand"
          loading={loading}
          caption="Arrivals in the last 7 days"
        />
        <AdminKpiTile
          label="Avg Visitors per Host"
          value={kpis.avgPerHost}
          icon={ICON_LIST}
          tone="brand"
          loading={loading}
          caption="This week's arrivals, split across every host"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        <div className="xl:col-span-2">
          <ChartCard
            heading="Hosts Directory"
            about="Every host, ranked by how many visitors they received this week."
          >
            {directory.length === 0 ? (
              <p className="text-sm text-navy-500 text-center py-8">No hosts recorded yet.</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {directory.map((h) => <HostDirectoryCard key={h.hostId} host={h} />)}
              </div>
            )}
          </ChartCard>
        </div>

        <ChartCard
          heading="Department Summary"
          about="This week's arrivals, grouped by the visitor's department."
        >
          <UtilizationRows
            headers={['Department', 'Share', 'Total Visits']}
            unit="visits"
            showShare
            rows={deptRows}
            emptyMessage="No arrivals this week, so there is nothing to summarize."
          />
        </ChartCard>
      </div>

      <ChartCard
        heading="Host Notifications"
        about="What a host is told when a visitor arrives for them."
      >
        <HostNotificationsPanel settings={settings} saving={saving} onToggle={onToggle} />
      </ChartCard>
    </div>
  );
}
