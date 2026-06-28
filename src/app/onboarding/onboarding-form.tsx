'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { provisionTenantAction } from '@/server/actions/auth';
import { slugify } from '@/lib/utils';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('onboarding');
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? '…' : t('continue')}
    </Button>
  );
}

export function OnboardingForm() {
  const t = useTranslations('onboarding');
  const tAuth = useTranslations('auth');
  const [state, action] = useFormState(provisionTenantAction, {});
  const [clinicName, setClinicName] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    if (!slug || slug === slugify(clinicName.slice(0, slug.length))) {
      setSlug(slugify(clinicName).slice(0, 48));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicName]);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="clinic_name">{t('clinic_name')}</Label>
        <Input
          id="clinic_name"
          name="clinic_name"
          required
          minLength={2}
          value={clinicName}
          onChange={(e) => setClinicName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">{t('slug')}</Label>
        <Input
          id="slug"
          name="slug"
          required
          minLength={3}
          maxLength={48}
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          pattern="^[a-z0-9]([a-z0-9-]*[a-z0-9])?$"
        />
        <p className="text-xs text-muted-foreground">{t('slug_help')}</p>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{tAuth(state.error as 'provision_failed')}</p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
