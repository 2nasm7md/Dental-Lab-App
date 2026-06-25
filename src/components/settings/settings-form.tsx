'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { Organization } from '@/lib/types/db';
import {
  updateOrgSettingsAction,
  updateOrgProfileAction,
} from '@/server/actions/settings';

export function SettingsForm({ organization }: { organization: Organization }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const isClinic = organization.type === 'clinic';

  const [profile, setProfile] = useState({
    name: organization.name,
    phone: organization.phone ?? '',
    email: organization.email ?? '',
    address: organization.address ?? '',
    currency: organization.currency,
  });
  const [settings, setSettings] = useState({
    all_doctors_see_all_cases:
      (organization.settings.all_doctors_see_all_cases as boolean) ?? false,
    cost_tracking_enabled:
      (organization.settings.cost_tracking_enabled as boolean) ?? true,
    techs_see_unassigned:
      (organization.settings.techs_see_unassigned as boolean) ?? true,
  });
  const [saved, setSaved] = useState<string | null>(null);

  const saveProfile = () =>
    start(async () => {
      await updateOrgProfileAction(profile);
      setSaved(t('actions.save'));
      setTimeout(() => setSaved(null), 1500);
    });

  const saveSettings = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    start(async () => {
      await updateOrgSettingsAction(patch);
    });
  };

  return (
    <div className="space-y-6">
      <section className="card p-5 space-y-4">
        <h2 className="font-semibold text-ink">{t('settings.orgProfile')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">{t('auth.orgName')}</label>
            <input
              className="input"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('auth.phone')}</label>
            <input
              className="input"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('auth.email')}</label>
            <input
              className="input"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Currency</label>
            <input
              className="input"
              maxLength={3}
              value={profile.currency}
              onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
            />
          </div>
        </div>
        <button className="btn-primary" disabled={pending} onClick={saveProfile}>
          {saved ?? t('actions.save')}
        </button>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold text-ink">{t('settings.preferences')}</h2>
        {isClinic ? (
          <Toggle
            label={t('settings.allDoctorsSeeAllCases')}
            hint={t('settings.allDoctorsSeeAllCasesHint')}
            value={settings.all_doctors_see_all_cases}
            onChange={(v) => saveSettings({ all_doctors_see_all_cases: v })}
          />
        ) : null}
        <Toggle
          label={t('settings.costTracking')}
          hint={t('settings.costTrackingHint')}
          value={settings.cost_tracking_enabled}
          onChange={(v) => saveSettings({ cost_tracking_enabled: v })}
        />
        {!isClinic ? (
          <Toggle
            label={t('settings.techsSeeUnassigned')}
            value={settings.techs_see_unassigned}
            onChange={(v) => saveSettings({ techs_see_unassigned: v })}
          />
        ) : null}
      </section>
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div className="min-w-0">
        <div className="font-medium text-ink">{label}</div>
        {hint ? <div className="text-sm text-ink-muted">{hint}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          value ? 'bg-brand-600' : 'bg-surface-border'
        }`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
            value ? 'start-5' : 'start-0.5'
          }`}
        />
      </button>
    </label>
  );
}
