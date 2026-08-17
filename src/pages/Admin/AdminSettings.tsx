import React from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminPageHeader from './AdminPageHeader';
import SettingsRail from './SettingsRail';
import SettingsDepartments from './SettingsDepartments';
import SettingsUsers from './SettingsUsers';
import {
  SETTINGS_SECTIONS, sectionFromSlug, type SettingsSectionKey,
} from '../../lib/settingsSections';

// The admin Settings screen: two sections down the left, the chosen one on the
// right. Departments and Users.
//
// THERE IS NO SAVE BUTTON, and its absence is the point. Until 2026-08-17 this
// page held six sections of stored key/value switches under one "Save Changes"
// control, and a large minority of those switches were labelled "Recorded — not
// yet enforced" because nothing read them. Both sections that remain write at
// the moment the admin confirms — a department is created, a user is added, an
// account is suspended — so a page-level save would govern nothing and would be
// the same lie in a different shape.
//
// The section lives in `?section=`, so a colleague can be sent straight to
// Users. Every stale slug from the deleted sections degrades onto Departments
// (see `sectionFromSlug`).

const PANEL: Record<SettingsSectionKey, React.ReactElement> = {
  departments: <SettingsDepartments />,
  users: <SettingsUsers />,
};

export default function AdminSettings(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const section: SettingsSectionKey = sectionFromSlug(params.get('section'));

  // `sectionFromSlug` has already degraded an unknown slug, so the find cannot
  // miss; the assertion is for the compiler, which has no way to know
  // SETTINGS_SECTIONS is non-empty.
  const active = (SETTINGS_SECTIONS.find((s) => s.key === section)
    ?? SETTINGS_SECTIONS[0]) as typeof SETTINGS_SECTIONS[number];

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <AdminPageHeader title="Settings" />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-5">
        <SettingsRail
          active={section}
          onSelect={(key) => setParams({ section: key }, { replace: true })}
        />

        <div className="space-y-5">
          <p className="text-sm text-navy-700 max-w-2xl">{active.blurb}</p>
          {PANEL[active.key]}
        </div>
      </div>
    </div>
  );
}
