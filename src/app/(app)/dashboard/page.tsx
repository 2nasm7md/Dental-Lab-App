import { getTranslations } from 'next-intl/server';
import { Inbox, Hourglass, Hammer, PackageCheck, AlertTriangle } from 'lucide-react';
import { getCurrentSession } from '@/lib/current-user';
import { getDashboardCounts, listCases } from '@/lib/queries/cases';
import { sideOfOrgType } from '@/lib/case-state-machine';
import { CaseListCard } from '@/components/cases/case-list-card';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = (await getCurrentSession())!;
  const t = await getTranslations();
  const side = sideOfOrgType(session.organization!.type);

  const [counts, recent, attention] = await Promise.all([
    getDashboardCounts(),
    listCases({ status: 'active' }),
    listCases({ status: 'attention' }),
  ]);

  const stats = [
    { key: 'totalCases', value: counts.total, icon: <Inbox className="size-5" />, tone: 'text-brand-700 bg-brand-50' },
    {
      key: side === 'lab' ? 'pendingResponse' : 'pendingResponse',
      value: counts.pending,
      icon: <Hourglass className="size-5" />,
      tone: 'text-amber-700 bg-amber-50',
    },
    { key: 'inProduction', value: counts.inProduction, icon: <Hammer className="size-5" />, tone: 'text-blue-700 bg-blue-50' },
    { key: 'readyToDeliver', value: counts.ready, icon: <PackageCheck className="size-5" />, tone: 'text-violet-700 bg-violet-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t('dashboard.title')}</h1>
        {side === 'clinic' ? (
          <Link href="/cases/new" className="btn-primary">
            {t('nav.newCase')}
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.key} className="card p-4 flex items-center gap-3">
            <div className={`size-10 rounded-xl grid place-items-center ${s.tone}`}>
              {s.icon}
            </div>
            <div>
              <div className="text-xs text-ink-subtle">{t(`dashboard.${s.key}`)}</div>
              <div className="text-xl font-bold text-ink">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {attention.length > 0 ? (
        <section className="card p-4 border-amber-200 bg-amber-50/40">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-5 text-amber-700" />
            <h2 className="font-semibold text-ink">{t('dashboard.needsAttention')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attention.slice(0, 4).map((c) => (
              <CaseListCard key={c.id} c={c} side={side} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink">{t('dashboard.active')}</h2>
          <Link href="/cases" className="text-sm font-medium text-brand-700">
            {t('actions.viewAll')}
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recent.slice(0, 6).map((c) => (
              <CaseListCard key={c.id} c={c} side={side} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
