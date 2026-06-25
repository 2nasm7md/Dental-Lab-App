import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { signUpAction } from '@/server/actions/auth';
import { FormBanner } from '@/components/forms/form-banner';

export default async function SignupPage() {
  const t = await getTranslations();

  async function action(formData: FormData) {
    'use server';
    const result = await signUpAction(formData);
    if (!result.ok) return result;
  }

  return (
    <div className="card p-8">
      <h1 className="text-2xl font-bold text-ink mb-1">{t('auth.signUp')}</h1>
      <p className="text-sm text-ink-muted mb-6">{t('app.tagline')}</p>
      <FormBanner />
      <form action={action} className="space-y-4">
        <div>
          <label className="label">{t('auth.fullName')}</label>
          <input name="fullName" required className="input" />
        </div>
        <div>
          <label className="label">{t('auth.email')}</label>
          <input name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label">{t('auth.phone')}</label>
          <input name="phone" type="tel" className="input" />
        </div>
        <div>
          <label className="label">{t('auth.password')}</label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="input"
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          {t('auth.signUp')}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-muted text-center">
        {t('auth.alreadyHaveAccount')}{' '}
        <Link href="/login" className="text-brand-700 font-medium">
          {t('auth.signIn')}
        </Link>
      </p>
    </div>
  );
}
