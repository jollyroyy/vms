// The typed half of migration 089's key/value settings store.
//
// The database column is `jsonb`, so nothing there enforces that
// `checkin.require_photo` is a boolean. This file is where that is decided:
// every key has a declared type and a documented default, reads are COERCED
// rather than trusted, and a missing or malformed row falls back to the
// default instead of rendering `undefined` into a switch.
//
// The default here and the seeded value in migration 089 are ONE schema written
// twice — edit them together. Every default is the behaviour the app already
// had before it had a settings table, so applying the migration changes
// nothing until an admin moves a switch.

import { supabase } from '../supabaseClient';

export type SettingValue = boolean | number | string;

/** Every key the app reads, with the type it must be. */
export const SETTING_DEFAULTS = {
  'general.facility_name': 'Quest Mall',
  // 'general.timezone' was REMOVED 2026-08-17 (client instruction). It was a
  // one-option select nothing read: the zone lives in `vms_day_start_ist`
  // and `IST_OFFSET_MS`, and a settings key shadowing them could only ever
  // disagree with them. Its `app_settings` row is deleted by migration 093 —
  // a key left in the table with no reader is indistinguishable from a
  // setting that quietly stopped working.

  'checkin.require_photo': true,
  'checkin.require_id_scan': true,
  'checkin.require_card_number': true,
  'checkin.require_nda': false,
  'checkin.walkin_without_host': false,
  'checkin.auto_signout_hours': 12,

  'badges.printing_enabled': true,
  'badges.default_type': 'visitor',
  'badges.show_photo': true,
  'badges.show_qr': true,

  'notify.host_email_on_arrival': true,
  'notify.host_sms_on_arrival': false,
  'notify.host_signout_reminder': true,
  'notify.signout_reminder_time': '17:00',
  'notify.overdue_nudge_minutes': 120,

  'prereg.email_invites': false,
  'prereg.public_link': false,
  'prereg.whatsapp_share': true,

  'integrations.whatsapp_enabled': true,
  'integrations.email_enabled': true,
  'integrations.webhook_url': '',

  'kiosk.enabled': true,
  'kiosk.language': 'en',
  'kiosk.idle_reset_seconds': 60,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingsMap = { [K in SettingKey]: typeof SETTING_DEFAULTS[K] extends boolean
  ? boolean
  : typeof SETTING_DEFAULTS[K] extends number ? number : string };

export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

/**
 * Coerce one raw jsonb value to the type its key declares.
 *
 * A row whose value is the WRONG type falls back to the default rather than
 * being cast into something plausible: `Number('on')` is NaN and `Boolean('')`
 * is false, and both would present as a deliberate choice an admin never made.
 * The one exception is a numeric string, which is what an `<input type="number">`
 * produces if a save path ever forgets to parse it.
 */
export function coerceSetting(key: SettingKey, raw: unknown): SettingValue {
  const fallback = SETTING_DEFAULTS[key] as SettingValue;
  if (raw === null || raw === undefined) return fallback;

  if (typeof fallback === 'boolean') {
    return typeof raw === 'boolean' ? raw : fallback;
  }
  if (typeof fallback === 'number') {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
      return Number(raw);
    }
    return fallback;
  }
  return typeof raw === 'string' ? raw : fallback;
}

/** The full settings map, defaults applied for anything the store is missing. */
export function settingsFromRows(rows: { key: string; value: unknown }[]): SettingsMap {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<string, SettingValue>;
  for (const key of SETTING_KEYS) {
    out[key] = coerceSetting(key, byKey.get(key));
  }
  return out as SettingsMap;
}

/** Defaults only — what the app behaves with before the store has loaded, and
 *  what it falls back to if the read fails. Never an empty object: a settings
 *  screen rendering blank switches reads as "everything is off". */
export function defaultSettings(): SettingsMap {
  return { ...SETTING_DEFAULTS } as unknown as SettingsMap;
}

/** Read every setting. Errors resolve to defaults rather than throwing — a
 *  failed settings read must not take down the gate. */
export async function loadSettings(): Promise<SettingsMap> {
  const { data, error } = await supabase.from('app_settings').select('key, value');
  if (error || !data) return defaultSettings();
  return settingsFromRows(data as { key: string; value: unknown }[]);
}

/**
 * Persist changed keys. Upsert rather than update, so a key added to this file
 * after the migration ran still saves — 089's insert policy is admin-only, so
 * this is no wider a permission than the update it replaces.
 *
 * `updated_by` is set to the caller's own id because the policy requires it to
 * be that or null; a settings row that can name someone else as the last editor
 * is not an audit trail.
 */
export async function saveSettings(
  changed: Partial<SettingsMap>,
  userId: string | null,
): Promise<{ error: string | null }> {
  const rows = (Object.keys(changed) as SettingKey[]).map((key) => ({
    key,
    value: changed[key] as SettingValue,
    updated_by: userId,
  }));
  if (rows.length === 0) return { error: null };

  // The project ships no generated database types, so PostgREST's builder
  // infers `never` for an unknown table's insert payload. The cast is at the
  // boundary and the row shape is checked by `SettingKey` above it.
  const { error } = await supabase
    .from('app_settings')
    .upsert(rows as never[], { onConflict: 'key' });
  return { error: error ? error.message : null };
}
