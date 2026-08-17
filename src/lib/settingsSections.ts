// The shape of the admin Settings screen: TWO sections, Departments and Users.
// One declaration, in one file, so the left-hand rail and the right-hand panel
// cannot describe different screens — the same rule `visitorSegments.ts`
// follows for the guard's surface.
//
// IT USED TO BE SIX (client instruction, 2026-08-17: keep Departments and
// Users, remove everything else, Integrations included). What went:
//
//   General · Check-In Rules · Badges · Notifications · Integrations
//
// Twenty-six switches, of which a large minority were marked "Recorded — not
// yet enforced" and openly governed nothing: no signature step for Require NDA,
// no SMS provider, no webhook dispatcher (pg_net is not installed on this
// project, so a scheduled job cannot make an HTTP call at all), no public
// self-registration route. The `enforced` flag was an honest label on a screen
// that should not have been offering the control in the first place — a screen
// where some switches govern behaviour and others merely store a preference is
// a screen an admin has to be taught to read.
//
// WHAT IS NOT DELETED. `app_settings` (migration 089), its twenty-six rows and
// `src/lib/appSettings.ts` all stay, and the Hosts tab still reads and writes
// the `notify.*` keys through them — that is where host notification settings
// are actually acted on. Deleting the store to match the screen would have
// taken a working feature with it. What is gone is this screen's claim to
// configure things it could not.
//
// Neither section carries fields: each renders a component. That is why there
// is no Save button on the page any more — Departments and Users both save at
// the moment the admin confirms, and a global "Save Changes" governing nothing
// would be the same kind of lie in a different shape.

export type SettingsSectionKey = 'departments' | 'users';

export type SettingsSection = {
  key: SettingsSectionKey;
  label: string;
  /** One line under the rail item's own heading, on the panel. */
  blurb: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    key: 'departments',
    label: 'Departments',
    blurb: 'Departments and the heads of department who approve their visitors. A head of '
      + 'department is added by name and email — an existing account is promoted, a new one '
      + 'is invited.',
  },
  {
    key: 'users',
    label: 'Users',
    blurb: 'Every account that can sign in to VMS. Add a guard, a head of department or a '
      + 'staff host, change what someone is, or withdraw access without destroying the '
      + 'record of what they were.',
  },
];

export const SETTINGS_SECTION_KEYS = SETTINGS_SECTIONS.map((s) => s.key);

/** The section a slug names, degrading onto Departments rather than rendering
 *  an empty panel — the value is in the URL and therefore in bookmarks. The
 *  five deleted section slugs (`general`, `checkin`, `badges`, `notifications`,
 *  `integrations`) and the old `roles` slug all land here, which is what makes
 *  a stale `?section=` link open a real screen instead of nothing. */
export function sectionFromSlug(slug: string | null | undefined): SettingsSectionKey {
  const hit = SETTINGS_SECTIONS.find((s) => s.key === slug);
  return hit ? hit.key : 'departments';
}
