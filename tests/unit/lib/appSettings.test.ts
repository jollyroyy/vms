// The typed half of migration 089's settings store (src/lib/appSettings.ts).
// Only the pure functions — loadSettings/saveSettings hit supabase and are
// out of scope here.
import { describe, it, expect } from 'vitest';
import { coerceSetting, settingsFromRows, defaultSettings, SETTING_DEFAULTS } from '../../../src/lib/appSettings';

describe('coerceSetting — boolean keys', () => {
  it('accepts a real boolean', () => {
    expect(coerceSetting('checkin.require_photo', false)).toBe(false);
    expect(coerceSetting('checkin.require_nda', true)).toBe(true);
  });

  it('falls back to the default on a wrong-type value rather than casting it', () => {
    // `Boolean('on')` is true, which would read as a deliberate choice nobody
    // made. The default for require_photo is `true`, so pick a raw value whose
    // cast would disagree with the fallback to prove it is not being cast.
    expect(coerceSetting('checkin.require_nda', 'on')).toBe(SETTING_DEFAULTS['checkin.require_nda']);
    expect(coerceSetting('checkin.require_nda', 1)).toBe(SETTING_DEFAULTS['checkin.require_nda']);
  });

  it('falls back to the default on null/undefined', () => {
    expect(coerceSetting('checkin.require_photo', null)).toBe(SETTING_DEFAULTS['checkin.require_photo']);
    expect(coerceSetting('checkin.require_photo', undefined)).toBe(SETTING_DEFAULTS['checkin.require_photo']);
  });
});

describe('coerceSetting — number keys', () => {
  it('accepts a real finite number', () => {
    expect(coerceSetting('checkin.auto_signout_hours', 8)).toBe(8);
  });

  it('accepts a numeric STRING — what an <input type="number"> produces if a save path forgets to parse it', () => {
    expect(coerceSetting('checkin.auto_signout_hours', '9')).toBe(9);
  });

  it('falls back to the default on a non-numeric string, not NaN', () => {
    expect(coerceSetting('checkin.auto_signout_hours', 'twelve')).toBe(SETTING_DEFAULTS['checkin.auto_signout_hours']);
  });

  it('falls back to the default on a non-finite number', () => {
    expect(coerceSetting('checkin.auto_signout_hours', Infinity)).toBe(SETTING_DEFAULTS['checkin.auto_signout_hours']);
  });

  it('falls back to the default on an empty string', () => {
    expect(coerceSetting('checkin.auto_signout_hours', '')).toBe(SETTING_DEFAULTS['checkin.auto_signout_hours']);
  });
});

describe('coerceSetting — string keys', () => {
  it('accepts a real string, including an empty one', () => {
    expect(coerceSetting('integrations.webhook_url', 'https://example.com/hook')).toBe('https://example.com/hook');
    expect(coerceSetting('integrations.webhook_url', '')).toBe('');
  });

  it('falls back to the default on a non-string value', () => {
    expect(coerceSetting('general.facility_name', 42)).toBe(SETTING_DEFAULTS['general.facility_name']);
    expect(coerceSetting('general.facility_name', true)).toBe(SETTING_DEFAULTS['general.facility_name']);
  });
});

describe('settingsFromRows', () => {
  it('fills in the declared default for every key the store is missing', () => {
    const settings = settingsFromRows([]);
    expect(settings).toEqual(defaultSettings());
  });

  it('applies a stored value on top of the defaults', () => {
    const settings = settingsFromRows([{ key: 'checkin.require_photo', value: false }]);
    expect(settings['checkin.require_photo']).toBe(false);
    // Everything else is untouched.
    expect(settings['badges.printing_enabled']).toBe(SETTING_DEFAULTS['badges.printing_enabled']);
  });

  it('quietly falls back a single malformed row without corrupting the rest of the map', () => {
    const settings = settingsFromRows([
      { key: 'checkin.require_photo', value: 'yes' }, // wrong type
      { key: 'kiosk.language', value: 'hi' }, // valid
    ]);
    expect(settings['checkin.require_photo']).toBe(SETTING_DEFAULTS['checkin.require_photo']);
    expect(settings['kiosk.language']).toBe('hi');
  });

  it('ignores a row keyed to something the app never reads', () => {
    const settings = settingsFromRows([{ key: 'not.a.real.key', value: 'whatever' }]);
    expect(settings).toEqual(defaultSettings());
  });
});

describe('defaultSettings', () => {
  it('is never an empty object — a blank settings screen reads as everything off', () => {
    expect(Object.keys(defaultSettings()).length).toBeGreaterThan(0);
  });

  it('matches SETTING_DEFAULTS exactly', () => {
    expect(defaultSettings()).toEqual(SETTING_DEFAULTS);
  });

  it('returns a fresh object each call — mutating one result must not affect the next', () => {
    const a = defaultSettings();
    (a as Record<string, unknown>)['general.facility_name'] = 'Tampered';
    const b = defaultSettings();
    expect(b['general.facility_name']).toBe(SETTING_DEFAULTS['general.facility_name']);
  });
});
