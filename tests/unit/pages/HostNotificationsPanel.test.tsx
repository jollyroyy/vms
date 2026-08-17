import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import HostNotificationsPanel from '../../../src/pages/Admin/HostNotificationsPanel';
import { defaultSettings } from '../../../src/lib/appSettings';

afterEach(cleanup);

describe('HostNotificationsPanel', () => {
  it('renders one switch per notification setting, with the label as its accessible name and aria-checked reflecting the stored value', () => {
    const s = { ...defaultSettings(), 'notify.host_email_on_arrival': true, 'notify.host_sms_on_arrival': false } as any;
    render(<HostNotificationsPanel settings={s} saving={null} onToggle={() => {}} />);

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(3);

    const email = screen.getByRole('switch', { name: 'Email on arrival' });
    expect(email).toHaveAttribute('aria-checked', 'true');
    const sms = screen.getByRole('switch', { name: 'SMS on arrival' });
    expect(sms).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onToggle with the setting key and the negated value when its switch is clicked', () => {
    const s = { ...defaultSettings(), 'notify.host_email_on_arrival': true } as any;
    const onToggle = vi.fn();
    render(<HostNotificationsPanel settings={s} saving={null} onToggle={onToggle} />);

    screen.getByRole('switch', { name: 'Email on arrival' }).click();
    expect(onToggle).toHaveBeenCalledWith('notify.host_email_on_arrival', false);
  });

  it('disables only the switch currently saving', () => {
    const s = { ...defaultSettings() } as any;
    render(<HostNotificationsPanel settings={s} saving="notify.host_sms_on_arrival" onToggle={() => {}} />);

    expect(screen.getByRole('switch', { name: 'SMS on arrival' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Email on arrival' })).not.toBeDisabled();
  });

  // A control that looks live before its value has loaded invites a click
  // that writes the default over a setting that was actually stored
  // differently — so every switch is disabled while settings is null.
  it('disables every switch while settings is null', () => {
    render(<HostNotificationsPanel settings={null} saving={null} onToggle={() => {}} />);
    for (const sw of screen.getAllByRole('switch')) {
      expect(sw).toBeDisabled();
    }
  });

  it('renders the "Recorded — not yet enforced" caveat for an unenforced field', () => {
    // notify.host_sms_on_arrival is enforced: false in settingsSections.ts.
    const s = { ...defaultSettings() } as any;
    render(<HostNotificationsPanel settings={s} saving={null} onToggle={() => {}} />);
    expect(screen.getAllByText(/Recorded — not yet enforced/).length).toBeGreaterThan(0);
  });

  // REGRESSION GUARD (client report, 2026-08-17): the Host Notifications
  // switches were invisible when off, because this panel used to hand-roll its
  // own toggle whose OFF track was bg-surface-200 — the same value as the card
  // behind it. It now renders the shared SettingToggle, whose off track is a
  // step darker (bg-surface-300); a second hand-rolled copy is what drifted.
  it('carries no bg-surface-200 track — the shared SettingToggle, not a second hand-rolled copy', () => {
    const s = { ...defaultSettings() } as any;
    const { container } = render(<HostNotificationsPanel settings={s} saving={null} onToggle={() => {}} />);
    expect(container.querySelector('.bg-surface-200')).toBeNull();
  });
});
