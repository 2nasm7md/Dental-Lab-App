import { Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { requireOnboarded } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Doctor } from '@/lib/types/db';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { DoctorsManager } from './doctors-manager';

export default async function DoctorsPage() {
  const session = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('doctors')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false });
  const doctors = (data ?? []) as Doctor[];
  const t = await getTranslations('doctors');

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />
      {doctors.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('empty')}
          description={t('empty_help')}
          action={<DoctorsManager doctors={[]} role={session.role} hideList />}
        />
      ) : (
        <DoctorsManager doctors={doctors} role={session.role} />
      )}
    </div>
  );
}
