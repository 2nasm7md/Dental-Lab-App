'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { hasPermission } from '@/lib/auth/permissions';
import type { ClinicSettings, Role, Tenant } from '@/lib/types/db';
import { updateClinicSettings } from '@/server/actions/settings';

interface Props {
  role: Role;
  settings: ClinicSettings;
  tenant: Tenant;
}

export function SettingsForm({ role, settings, tenant }: Props) {
  const canManage = hasPermission(role, 'settings.manage');
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rtl, setRtl] = useState(settings.rtl_enabled);
  const [isPublic, setIsPublic] = useState(tenant.public);
  const [locale, setLocale] = useState(settings.default_locale);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          try {
            await updateClinicSettings({
              display_name: String(fd.get('display_name')),
              tagline: String(fd.get('tagline') ?? ''),
              logo_url: String(fd.get('logo_url') ?? ''),
              primary_color: String(fd.get('primary_color')),
              secondary_color: String(fd.get('secondary_color')),
              phone: String(fd.get('phone') ?? ''),
              whatsapp: String(fd.get('whatsapp') ?? ''),
              email: String(fd.get('email') ?? ''),
              address: String(fd.get('address') ?? ''),
              about: String(fd.get('about') ?? ''),
              default_locale: locale,
              rtl_enabled: rtl,
              public: isPublic,
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'error');
          }
        });
      }}
      className="grid gap-6 lg:grid-cols-2"
    >
      <Card>
        <CardHeader><CardTitle>{t('branding')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label={t('display_name')}>
            <Input name="display_name" required defaultValue={settings.display_name} />
          </Field>
          <Field label={t('tagline')}>
            <Input name="tagline" defaultValue={settings.tagline ?? ''} />
          </Field>
          <Field label={t('logo')}>
            <Input name="logo_url" type="url" defaultValue={settings.logo_url ?? ''} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('primary_color')}>
              <Input
                name="primary_color"
                type="color"
                defaultValue={settings.primary_color}
              />
            </Field>
            <Field label={t('secondary_color')}>
              <Input
                name="secondary_color"
                type="color"
                defaultValue={settings.secondary_color}
              />
            </Field>
          </div>
          <Field label={t('about')}>
            <Textarea name="about" rows={4} defaultValue={settings.about ?? ''} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('contact')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label={t('phone')}>
            <Input name="phone" defaultValue={settings.phone ?? ''} />
          </Field>
          <Field label={t('whatsapp')}>
            <Input name="whatsapp" defaultValue={settings.whatsapp ?? ''} />
          </Field>
          <Field label={t('email')}>
            <Input name="email" type="email" defaultValue={settings.email ?? ''} />
          </Field>
          <Field label={t('address')}>
            <Textarea name="address" rows={2} defaultValue={settings.address ?? ''} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('localisation')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label={t('default_locale')}>
            <Select value={locale} onValueChange={(v) => setLocale(v as 'ar' | 'en')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>{t('rtl')}</Label>
            <Switch checked={rtl} onCheckedChange={setRtl} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('public_site')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>{t('public_toggle')}</Label>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <p className="text-xs text-muted-foreground">
            /c/{tenant.slug}
          </p>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
        {canManage && (
          <Button type="submit" disabled={pending}>
            {pending ? '…' : tc('save')}
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
