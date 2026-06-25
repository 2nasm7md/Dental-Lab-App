import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Filter, Plus } from 'lucide-react';
import { getCurrentSession } from '@/lib/current-user';
import { listCases, type CaseFilters } from '@/lib/queries/cases';
import { sideOfOrgType } from '@/lib/case-state-machine';
import { CaseListCard } from '@/components/cases/case-list-card';
import { EmptyState } from '@/components/ui/empty-state';
import { CaseFiltersBar } from '@/components/cases/case-filters-bar';
import type { CaseStatus } from '@/lib/types/db';

export default async function CasesPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const session = (await getCurrentSession())!;
  const t = await getTranslations();
  const side = sideOfOrgType(session.organization!.type);

  const filters: CaseFilters = {
    status: (searchParams.status as CaseStatus) ?? 'all',
    q: searchParams.q,
  };

  const cases = await listCases(filters);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-ink">{t('nav.cases')}</h1>
        {side === 'clinic' ? (
          <Link href="/cases/new" className="btn-primary">
            <Plus className="size-4" />
            {t('nav.newCase')}
          </Link>
        ) : null}
      </div>

      <CaseFiltersBar />

      {cases.length === 0 ? (
        <EmptyState
          icon={<Filter className="size-8" />}
          title={t('case.noCases')}
          description={side === 'clinic' ? t('case.createFirst') : ''}
          action={
            side === 'clinic' ? (
              <Link href="/cases/new" className="btn-primary">
                {t('nav.newCase')}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {cases.map((c) => (
            <CaseListCard key={c.id} c={c} side={side} />
          ))}
        </div>
      )}
    </div>
  );
}
