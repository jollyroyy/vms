import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import AdminPageHeader from './AdminPageHeader';
import SettingsRail from './SettingsRail';
import SettingsField from './SettingsField';
import SettingsRolesUsers from './SettingsRolesUsers';
import {
  SETTINGS_SECTIONS, sectionFromSlug, type SettingsSectionKey,
} from '../../lib/settingsSections';
import {
  defaultSettings, loadSettings, saveSettings,
  type SettingKey, type SettingValue, type SettingsMap,
} from '../../lib/appSettings';

// The admin Settings screen: six sections down the left, the chosen one's
// fields on the right, one Save Changes button governing all of them.
//
// UNSAVED EDITS ARE HELD IN `draft` AND SURVIVE A SECTION SWITCH. A single save
// button across six sections is only honest if moving between them does not
// quietly discard what was typed — otherwise an admin who edits Check-In Rules,
// glances at Badges and presses Save has saved nothing and been told it worked.
// `dirty` therefore tracks WHICH KEYS CHANGED across the whole form, and the
// save writes exactly those: an upsert of all twenty-six keys would stamp
// `updated_by` and `updated_at` on rows nobody touched, which turns the one
// audit signal this table carries into noise.
//
// The section lives in `?section=`, so Hosts can link straight to Roles & Users
// and so a half-finished configuration can be sent to a colleague as a URL.

export default function AdminSettings(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const section: SettingsSectionKey = sectionFromSlug(params.get('section'));

  const [saved, setSaved] = useState<SettingsMap>(defaultSettings);
  const [draft, setDraft] = useState<SettingsMap>(defaultSettings);
  const [dirty, setDirty] = useState<Set<SettingKey>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((s) => {
      if (cancelled) return;
      setSaved(s);
      setDraft(s);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const edit = useCallback((key: SettingKey, next: SettingValue) => {
    setDraft((d) => ({ ...d, [key]: next }));
    setDirty((keys) => {
      const out = new Set(keys);
      out.add(key);
      return out;
    });
    setNotice(null);
  }, []);

  const save = useCallback(async () => {
    if (dirty.size === 0) return;
    setSaving(true);

    const { data } = await supabase.auth.getUser();
    const changed: Partial<SettingsMap> = {};
    for (const key of dirty) (changed as Record<string, SettingValue>)[key] = draft[key];

    const { error } = await saveSettings(changed, data.user?.id ?? null);
    setSaving(false);

    if (error) {
      // The draft is KEPT on failure. Reverting to `saved` would throw away
      // what the admin typed to report that we could not store it, which is
      // the worst of both.
      setNotice({ kind: 'err', text: `Could not save: ${error}` });
      return;
    }
    setSaved(draft);
    setDirty(new Set());
    setNotice({ kind: 'ok', text: 'Settings saved.' });
  }, [dirty, draft]);

  // `sectionFromSlug` already degraded an unknown slug onto 'general', so the
  // find cannot miss; the assertion is for the compiler, which has no way to
  // know SETTINGS_SECTIONS is non-empty.
  const active = (SETTINGS_SECTIONS.find((s) => s.key === section)
    ?? SETTINGS_SECTIONS[0]) as typeof SETTINGS_SECTIONS[number];

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <AdminPageHeader
        title="Settings"
        action={
          <button
            type="button"
            onClick={() => void save()}
            disabled={dirty.size === 0 || saving || loading}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : dirty.size === 0 ? 'Save Changes' : `Save ${dirty.size} change${dirty.size === 1 ? '' : 's'}`}
          </button>
        }
      />

      {notice && (
        <p role="status"
           className={`mb-4 text-sm ${notice.kind === 'ok' ? 'text-success-700' : 'text-danger-700'}`}>
          {notice.text}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-5">
        <SettingsRail
          active={section}
          onSelect={(key) => setParams({ section: key }, { replace: true })}
        />

        <div className="space-y-5">
          {active.key === 'roles' ? (
            <SettingsRolesUsers />
          ) : loading ? (
            <p className="text-sm text-navy-500 py-8">Loading settings…</p>
          ) : (
            active.groups.map((group) => (
              <section
                key={group.heading}
                aria-label={group.heading}
                className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60 dark:border-white/[0.07] p-5 shadow-glow-sm"
              >
                <h2 className="font-display text-h2 text-navy-950 dark:text-white">{group.heading}</h2>
                {group.blurb && <p className="text-sm text-navy-500 mt-1 mb-2">{group.blurb}</p>}
                <div className="mt-2">
                  {group.fields.map((field) => (
                    <SettingsField
                      key={field.key}
                      field={field}
                      value={draft[field.key]}
                      onChange={(next) => edit(field.key, next)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      {/* `saved` is read here so an unchanged form can still say what is stored
          — and so the variable is not merely a stale copy nobody consults. */}
      <p className="sr-only">
        Facility currently configured as {String(saved['general.facility_name'])}.
      </p>
    </div>
  );
}
