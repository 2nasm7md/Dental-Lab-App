import { getTranslations } from 'next-intl/server';
import { requireOnboarded } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import type { ClinicSettings, Tenant } from '@/lib/types/db';
import { SettingsForm } from './settings-form';

export default async function SettingsPage() {
  const session = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const [{ data: settings }, { data: tenant }] = await Promise.all([
    supabase
      .from('clinic_settings')
      .select('*')
      .eq('tenant_id', session.tenantId)
      .single(),
    supabase
      .from('tenants')
      .select('*')
      .eq('id', session.tenantId)
      .single(),
  ]);
  const t = await getTranslations('settings');

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />
      <SettingsForm
        role={session.role}
        settings={settings as ClinicSettings}
        tenant={tenant as Tenant}
      />
    </div>
  );
}
