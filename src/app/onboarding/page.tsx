import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createOrgAction } from '@/server/actions/auth';
import { getCurrentSession } from '@/lib/current-user';
import { FormBanner } from '@/components/forms/form-banner';

export default async function OnboardingPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (session.profile?.organization_id) redirect('/dashboard');

  const t = await getTranslations();

  async function action(formData: FormData) {
    'use server';
    const r = await createOrgAction(formData);
    if (r && !r.ok) {
      const { redirect } = await import('next/navigation');
      redirect(`/onboarding?error=${encodeURIComponent(r.error ?? 'error')}`);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-surface-muted">
      <div className="card p-8 w-full max-w-xl">
        <h1 className="text-2xl font-bold text-ink mb-1">{t('auth.createOrJoin')}</h1>
        <p className="text-sm text-ink-muted mb-6">{t('app.tagline')}</p>
        <FormBanner />
        <form action={action} className="space-y-4">
          <div>
            <label className="label">{t('auth.iWorkAt')}</label>
            <div className="grid grid-cols-2 gap-3">
              <label className="card p-4 cursor-pointer flex items-center gap-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input type="radio" name="type" value="clinic" defaultChecked required />
                <span className="font-medium">{t('auth.clinic')}</span>
              </label>
              <label className="card p-4 cursor-pointer flex items-center gap-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input type="radio" name="type" value="lab" required />
                <span className="font-medium">{t('auth.lab')}</span>
              </label>
            </div>
          </div>
          <div>
            <label className="label">{t('auth.orgName')}</label>
            <input name="name" required minLength={2} className="input" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('auth.phone')}</label>
              <input name="phone" type="tel" className="input" />
            </div>
            <div>
              <label className="label">{t('auth.email')}</label>
              <input name="email" type="email" className="input" />
            </div>
          </div>
          <div>
            <label className="label">{t('settings.preferences')}</label>
            <input name="currency" defaultValue="USD" className="input" maxLength={3} />
          </div>
          <button type="submit" className="btn-primary w-full">
            {t('actions.create')}
          </button>
        </form>
      </div>
    </main>
  );
}
