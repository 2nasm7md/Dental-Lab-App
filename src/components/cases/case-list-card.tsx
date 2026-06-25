import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Calendar, Building2, User, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { CaseRow } from '@/lib/queries/cases';
import { formatDate } from '@/lib/utils';
import { isOverdue } from '@/lib/case-state-machine';

export function CaseListCard({ c, side }: { c: CaseRow; side: 'clinic' | 'lab' }) {
  const t = useTranslations();
  const locale = useLocale();
  const overdue = isOverdue(c.due_date, c.status);

  const counterParty = side === 'clinic' ? c.lab?.name : c.clinic?.name;
  const restorationLabel = c.restoration_type
    ? t(`restoration.${c.restoration_type}`)
    : '';

  return (
    <Link
      href={`/cases/${c.id}`}
      className="card p-4 block hover:shadow-pop transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-ink-subtle">{c.case_number}</div>
          <div className="font-semibold text-ink truncate">
            {c.patient_name || c.patient_ref || t('case.patient')}
          </div>
        </div>
        <StatusBadge status={c.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-y-2 text-sm text-ink-muted">
        {restorationLabel ? (
          <div className="col-span-2 truncate">
            <span className="text-ink-subtle">{t('case.restoration')}: </span>
            <span className="text-ink">
              {restorationLabel}
              {c.tooth_numbers.length > 0 ? ` · ${c.tooth_numbers.join(', ')}` : ''}
            </span>
          </div>
        ) : null}
        {counterParty ? (
          <div className="flex items-center gap-1.5 truncate">
            <Building2 className="size-4 shrink-0" />
            <span className="truncate">{counterParty}</span>
          </div>
        ) : null}
        {c.owner_doctor?.full_name ? (
          <div className="flex items-center gap-1.5 truncate">
            <User className="size-4 shrink-0" />
            <span className="truncate">{c.owner_doctor.full_name}</span>
          </div>
        ) : null}
        {c.due_date ? (
          <div
            className={`flex items-center gap-1.5 col-span-2 ${
              overdue ? 'text-red-700 font-medium' : ''
            }`}
          >
            {overdue ? (
              <AlertTriangle className="size-4 shrink-0" />
            ) : (
              <Calendar className="size-4 shrink-0" />
            )}
            <span>
              {overdue ? `${t('case.overdue')} · ` : `${t('case.dueDate')}: `}
              {formatDate(c.due_date, locale)}
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
