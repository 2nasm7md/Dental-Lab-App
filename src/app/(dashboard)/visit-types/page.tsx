import { Stethoscope } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { requireOnboarded } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { VisitType } from '@/lib/types/db';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { VisitTypesManager } from './visit-types-manager';

export default async function VisitTypesPage() {
  const session = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('visit_types')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false });
  const items = (data ?? []) as VisitType[];
  const t = await getTranslations('visit_types');

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />
      {items.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title={t('empty')}
          description={t('empty_help')}
          action={<VisitTypesManager items={[]} role={session.role} hideList />}
        />
      ) : (
        <VisitTypesManager items={items} role={session.role} />
      )}
    </div>
  );
}
