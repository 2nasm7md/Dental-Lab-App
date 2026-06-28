'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signupAction } from '@/server/actions/auth';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('auth');
  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending ? '…' : t('signup')}
    </Button>
  );
}

export function SignupForm() {
  const t = useTranslations('auth');
  const [state, action] = useFormState(signupAction, {});

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">{t('full_name')}</Label>
        <Input id="full_name" name="full_name" required autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{t(state.error as 'signup_failed')}</p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
