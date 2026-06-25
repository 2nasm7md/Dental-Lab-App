import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Sparkles, Stethoscope, MessageSquare, BarChart3 } from 'lucide-react';
import { getCurrentSession } from '@/lib/current-user';
import { redirect } from 'next/navigation';

export default async function LandingPage() {
  const session = await getCurrentSession();
  if (session?.profile?.organization_id) redirect('/dashboard');
  if (session && !session.profile?.organization_id) redirect('/onboarding');

  const t = await getTranslations();

  const features = [
    { icon: <Stethoscope className="size-5" />, key: 'cases' as const },
    { icon: <Sparkles className="size-5" />, key: 'tracking' as const },
    { icon: <MessageSquare className="size-5" />, key: 'chat' as const },
    { icon: <BarChart3 className="size-5" />, key: 'billing' as const },
  ];

  return (
    <main className="min-h-screen">
      <header className="border-b border-surface-border bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-ink">
            <div className="size-8 rounded-xl bg-brand-600 text-white grid place-items-center">
              D
            </div>
            <span>{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost">
              {t('auth.signIn')}
            </Link>
            <Link href="/signup" className="btn-primary">
              {t('landing.getStarted')}
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-ink leading-tight">
          {t('landing.hero')}
        </h1>
        <p className="mt-4 text-lg text-ink-muted max-w-2xl mx-auto">
          {t('landing.sub')}
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            {t('landing.getStarted')}
          </Link>
          <Link href="/login" className="btn-secondary px-6 py-3 text-base">
            {t('auth.signIn')}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((f) => (
          <div key={f.key} className="card p-6">
            <div className="size-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center mb-3">
              {f.icon}
            </div>
            <div className="font-semibold text-ink">
              {t(`landing.features.${f.key}.title`)}
            </div>
            <p className="text-sm text-ink-muted mt-1">
              {t(`landing.features.${f.key}.body`)}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
