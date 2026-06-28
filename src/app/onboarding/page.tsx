import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { OnboardingForm } from './onboarding-form';

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const { data: existing } = await supabase.from('tenant_users').select('tenant_id').limit(1);
  if (existing && existing.length > 0) redirect('/dashboard');

  const t = await getTranslations('onboarding');

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-card">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        <div className="mt-6">
          <OnboardingForm />
        </div>
      </div>
    </main>
  );
}
