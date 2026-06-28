import { Image as ImageIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { requireOnboarded } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { PortfolioCase } from '@/lib/types/db';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PortfolioManager } from './portfolio-manager';

export default async function PortfolioPage() {
  const session = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('portfolio_cases')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false });
  const items = (data ?? []) as PortfolioCase[];
  const t = await getTranslations('portfolio');

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />
      {items.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={t('empty')}
          action={<PortfolioManager items={[]} role={session.role} hideList />}
        />
      ) : (
        <PortfolioManager items={items} role={session.role} />
      )}
    </div>
  );
}
