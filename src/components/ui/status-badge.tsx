import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import type { CaseStatus } from '@/lib/types/db';

const TONE: Record<CaseStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-100 text-amber-800',
  declined: 'bg-red-100 text-red-700',
  accepted: 'bg-emerald-100 text-emerald-800',
  in_production: 'bg-blue-100 text-blue-800',
  ready: 'bg-violet-100 text-violet-800',
  delivered: 'bg-green-100 text-green-800',
  redo: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

export function StatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  const t = useTranslations('status');
  return (
    <span className={cn('badge', TONE[status], className)}>{t(status)}</span>
  );
}
