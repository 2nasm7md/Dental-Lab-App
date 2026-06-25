import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Building2, Wallet } from 'lucide-react';
import { requireSession } from '@/lib/current-user';
import { sideOfOrgType } from '@/lib/case-state-machine';
import {
  getClinicPartnerTotals,
  getLabPartnerTotals,
} from '@/lib/queries/billing';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency } from '@/lib/utils';

export default async function BillingPage() {
  const session = await requireSession();
  const t = await getTranslations();
  const side = sideOfOrgType(session.organization.type);
  const enabled =
    (session.organization.settings as { cost_tracking_enabled?: boolean })
      .cost_tracking_enabled !== false;
  if (!enabled) redirect('/dashboard');

  const totals =
    side === 'clinic' ? await getClinicPartnerTotals() : await getLabPartnerTotals();
  const currency = session.organization.currency;

  const overall = totals.reduce(
    (acc, row) => {
      acc.billed += row.totalBilled;
      acc.paid += row.totalPaid;
      acc.balance += row.balance;
      return acc;
    },
    { billed: 0, paid: 0, balance: 0 }
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t('nav.billing')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat
          label={side === 'clinic' ? t('payment.totalSent') : t('payment.totalBilled')}
          value={formatCurrency(overall.billed, currency)}
          tone="text-brand-700 bg-brand-50"
        />
        <Stat
          label={side === 'clinic' ? t('payment.totalPaid') : t('payment.totalReceived')}
          value={formatCurrency(overall.paid, currency)}
          tone="text-emerald-700 bg-emerald-50"
        />
        <Stat
          label={side === 'clinic' ? t('payment.owed') : t('payment.balance')}
          value={formatCurrency(overall.balance, currency)}
          tone={
            overall.balance > 0
              ? 'text-amber-800 bg-amber-50'
              : 'text-emerald-700 bg-emerald-50'
          }
        />
      </div>

      {totals.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-8" />}
          title={t('common.noResults')}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-ink-subtle text-xs uppercase">
              <tr>
                <th className="text-start px-4 py-2.5">
                  {side === 'clinic' ? t('case.lab') : t('case.clinic')}
                </th>
                <th className="text-end px-4 py-2.5">{t('dashboard.totalCases')}</th>
                <th className="text-end px-4 py-2.5">
                  {side === 'clinic' ? t('payment.totalSent') : t('payment.totalBilled')}
                </th>
                <th className="text-end px-4 py-2.5">
                  {side === 'clinic' ? t('payment.totalPaid') : t('payment.totalReceived')}
                </th>
                <th className="text-end px-4 py-2.5">
                  {side === 'clinic' ? t('payment.owed') : t('payment.balance')}
                </th>
              </tr>
            </thead>
            <tbody>
              {totals.map((row) => (
                <tr
                  key={row.partner.id}
                  className="border-t border-surface-border hover:bg-surface-muted/60"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/cases?partner=${row.partner.id}`}
                      className="flex items-center gap-2 font-medium text-ink"
                    >
                      <Building2 className="size-4 text-ink-subtle" />
                      {row.partner.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-ink-muted">
                    {row.caseCount}
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums">
                    {formatCurrency(row.totalBilled, currency)}
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-emerald-700">
                    {formatCurrency(row.totalPaid, currency)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-end tabular-nums font-medium ${
                      row.balance > 0 ? 'text-amber-800' : 'text-emerald-700'
                    }`}
                  >
                    {formatCurrency(row.balance, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`size-10 rounded-xl grid place-items-center ${tone}`}>
        <Wallet className="size-5" />
      </div>
      <div>
        <div className="text-xs text-ink-subtle">{label}</div>
        <div className="text-xl font-bold text-ink tabular-nums">{value}</div>
      </div>
    </div>
  );
}
