// The shape of the admin Settings screen: six sections, each a list of groups,
// each group a list of fields. One declaration per control, in one file, so the
// left-hand rail and the right-hand panel cannot describe different screens —
// the same rule `visitorSegments.ts` follows for the Visitors surface.
//
// EVERY FIELD DECLARES WHETHER THE APP HONOURS IT (`enforced`). A settings
// screen whose switches are all stored and only some obeyed is a screen that
// lies about what it controls, and this project has already deleted a
// hardcoded "Gate Status: Operational" chip and an unconditional "Identity
// verified" line for exactly that reason. A field with `enforced: false` is
// saved to the store and rendered with a "Recorded — not yet enforced" note, so
// an admin knows the difference between a rule and an intention.
//
// `roles` is the sixth section and carries NO fields: it hosts the existing
// Admin Panel (departments, heads of department, password reset, activity log)
// unchanged. Those were a separate page until the admin surface was rebuilt;
// they are user administration, which is what that section is for, and
// rewriting working CRUD to fit a new frame would risk the one part of this
// screen that already worked.

import type { SettingKey } from './appSettings';

export type SettingControl = 'toggle' | 'text' | 'number' | 'select' | 'time';

export type SettingField = {
  key: SettingKey;
  label: string;
  /** One line under the label. Omitted where it would restate the label. */
  hint?: string;
  control: SettingControl;
  /** For `select` only. */
  options?: { value: string; label: string }[];
  /** For `number` only — mirrors the DB CHECK where one exists. */
  min?: number;
  max?: number;
  /**
   * Does the running app actually obey this today? False means the value is
   * stored faithfully and nothing reads it yet.
   */
  enforced: boolean;
  /** Shown when `enforced` is false, or when obeying it has a caveat. */
  caveat?: string;
};

export type SettingGroup = { heading: string; blurb?: string; fields: SettingField[] };

export type SettingsSectionKey =
  | 'general' | 'checkin' | 'badges' | 'notifications' | 'integrations' | 'roles';

export type SettingsSection = {
  key: SettingsSectionKey;
  label: string;
  /** Empty for `roles`, which renders the Admin Panel instead of fields. */
  groups: SettingGroup[];
};

const YES_NO_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'bn', label: 'বাংলা (Bengali)' },
];

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    key: 'general',
    label: 'General',
    groups: [
      {
        heading: 'Facility Details',
        fields: [
          { key: 'general.facility_name', label: 'Facility Name', control: 'text', enforced: true,
            hint: 'Printed on the visitor pass and the exported register.' },
          { key: 'general.timezone', label: 'Time Zone', control: 'select', enforced: false,
            options: [{ value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' }],
            caveat: 'The app is IST end to end — the day boundary lives in the database (vms_day_start_ist). Changing this needs a migration, so only IST is offered.' },
        ],
      },
      {
        heading: 'Pre-registration',
        fields: [
          { key: 'prereg.whatsapp_share', label: 'Send pass on WhatsApp', control: 'toggle', enforced: true,
            hint: 'Shows the Send on WhatsApp button on the pre-approval pass.' },
          { key: 'prereg.email_invites', label: 'Email invites before visit', control: 'toggle', enforced: false,
            caveat: 'Needs an email sender. The built-in Supabase mailer is capped at ~2 messages an hour, project-wide.' },
          { key: 'prereg.public_link', label: 'Pre-registration link on website', control: 'toggle', enforced: false,
            caveat: 'No public self-registration route exists yet.' },
        ],
      },
      {
        heading: 'Kiosk',
        fields: [
          { key: 'kiosk.enabled', label: 'Kiosk mode on lobby tablets', control: 'toggle', enforced: true,
            hint: 'Turning this off makes /kiosk refuse to start a self-service check-in.' },
          { key: 'kiosk.language', label: 'Language', control: 'select', options: YES_NO_LANGUAGES, enforced: false,
            caveat: 'The kiosk ships English strings only; the choice is stored for when translations land.' },
          { key: 'kiosk.idle_reset_seconds', label: 'Idle reset', control: 'number', min: 15, max: 600,
            hint: 'Seconds of inactivity before the kiosk returns to its idle screen.', enforced: true },
        ],
      },
    ],
  },
  {
    key: 'checkin',
    label: 'Check-In Rules',
    groups: [
      {
        heading: 'Identity',
        blurb: 'What a guard must capture before the Check In button will submit.',
        fields: [
          { key: 'checkin.require_photo', label: 'Require photo capture at check-in', control: 'toggle', enforced: true,
            hint: 'The photo is the record of who actually walked in; an approval only says who was expected.' },
          { key: 'checkin.require_id_scan', label: 'Require ID scan', control: 'toggle', enforced: true },
          { key: 'checkin.require_card_number', label: 'Require visitor card number', control: 'toggle', enforced: true,
            hint: 'The card is demanded back at check-out. Turning this off leaves nothing to demand.' },
          { key: 'checkin.require_nda', label: 'Require NDA signature', control: 'toggle', enforced: false,
            caveat: 'There is no signature capture step in the check-in flow yet.' },
        ],
      },
      {
        heading: 'Walk-ins and departure',
        fields: [
          { key: 'checkin.walkin_without_host', label: 'Walk-in allowed without host confirmation', control: 'toggle', enforced: false,
            caveat: 'The gate cannot admit a walk-in the host has not cleared (migration 083). Changing this is a database change, not a setting.' },
          { key: 'checkin.auto_signout_hours', label: 'Flag as overstaying after', control: 'number', min: 1, max: 72, enforced: true,
            hint: 'Hours from check-in, when the approver set no expected departure. Feeds the guard dashboard Overstaying tile.' },
        ],
      },
    ],
  },
  {
    key: 'badges',
    label: 'Badges',
    groups: [
      {
        heading: 'Printing',
        blurb: 'A badge is minted at the gate by the guard who can see the visitor. These settings shape what prints; they do not let this screen print one.',
        fields: [
          { key: 'badges.printing_enabled', label: 'Badge printing enabled', control: 'toggle', enforced: true },
          { key: 'badges.default_type', label: 'Default badge type', control: 'select', enforced: true,
            options: [
              { value: 'visitor', label: 'Visitor' },
              { value: 'contractor', label: 'Contractor' },
            ] },
          { key: 'badges.show_photo', label: 'Print the visitor photo', control: 'toggle', enforced: true },
          { key: 'badges.show_qr', label: 'Print the QR code', control: 'toggle', enforced: true,
            hint: 'The QR is what the scan desk reads. Turning it off leaves the badge readable only by eye.' },
        ],
      },
    ],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    groups: [
      {
        heading: 'Host notifications',
        fields: [
          { key: 'notify.host_email_on_arrival', label: 'Email the host on arrival', control: 'toggle', enforced: true },
          { key: 'notify.host_sms_on_arrival', label: 'SMS the host on arrival', control: 'toggle', enforced: false,
            caveat: 'No SMS provider is configured. In-app notification is written either way.' },
          { key: 'notify.host_signout_reminder', label: 'Remind hosts to sign visitors out', control: 'toggle', enforced: false,
            caveat: 'The nightly sweep closes stale visits; a per-host reminder job does not exist yet.' },
          { key: 'notify.signout_reminder_time', label: 'Reminder time', control: 'time', enforced: false },
        ],
      },
      {
        heading: 'Overdue visitors',
        fields: [
          { key: 'notify.overdue_nudge_minutes', label: 'Nudge the host after', control: 'number', min: 15, max: 480, enforced: false,
            hint: 'Minutes past a booked slot with no arrival.',
            caveat: 'The live job runs at 120 minutes and is scheduled in the database (migration 070). Saving here does not reschedule it.' },
        ],
      },
    ],
  },
  {
    key: 'integrations',
    label: 'Integrations',
    groups: [
      {
        heading: 'Outbound',
        fields: [
          { key: 'integrations.whatsapp_enabled', label: 'WhatsApp share', control: 'toggle', enforced: true,
            hint: 'Opens the visitor’s own chat with the pass attached. One person forwarding one message — no Meta Business account involved.' },
          { key: 'integrations.email_enabled', label: 'Email', control: 'toggle', enforced: false,
            caveat: 'Only the notify-host edge function sends mail today, and it is not reachable from scheduled jobs.' },
          { key: 'integrations.webhook_url', label: 'Webhook URL', control: 'text', enforced: false,
            hint: 'Where visit events would be POSTed.',
            caveat: 'No dispatcher exists. pg_net is not installed on this project, so a scheduled job cannot make an HTTP call.' },
        ],
      },
    ],
  },
  { key: 'roles', label: 'Roles & Users', groups: [] },
];

export const SETTINGS_SECTION_KEYS = SETTINGS_SECTIONS.map((s) => s.key);

/** The section a slug names, degrading onto General rather than rendering an
 *  empty panel — the value is in the URL and therefore in bookmarks. */
export function sectionFromSlug(slug: string | null | undefined): SettingsSectionKey {
  const hit = SETTINGS_SECTIONS.find((s) => s.key === slug);
  return hit ? hit.key : 'general';
}
