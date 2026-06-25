import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/current-user';
import { SettingsForm } from '@/components/settings/settings-form';

export default async function SettingsPage() {
  const session = await requireSession();
  const t = await getTranslations();
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-ink">{t('nav.settings')}</h1>
      <SettingsForm organization={session.organization} />
    </div>
  );
}
