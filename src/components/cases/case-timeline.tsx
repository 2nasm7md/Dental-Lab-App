'use client';

import { useTranslations, useLocale } from 'next-intl';
import type { CaseStatusHistoryEntry } from '@/lib/types/db';
import { formatDateTime } from '@/lib/utils';

export function CaseTimeline({ entries }: { entries: CaseStatusHistoryEntry[] }) {
  const t = useTranslations();
  const locale = useLocale();

  if (entries.length === 0) {
    return <div className="text-sm text-ink-subtle">{t('common.noResults')}</div>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((e, i) => (
        <li key={e.id} className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <div className="size-2.5 rounded-full bg-brand-500" />
            {i < entries.length - 1 ? (
              <div className="w-px flex-1 bg-surface-border mt-1" />
            ) : null}
          </div>
          <div className="pb-2">
            <div className="text-sm font-medium text-ink">
              {e.from_status ? (
                <>
                  {t(`status.${e.from_status}`)} →{' '}
                  <span className="text-brand-700">{t(`status.${e.to_status}`)}</span>
                </>
              ) : (
                <span className="text-brand-700">{t(`status.${e.to_status}`)}</span>
              )}
            </div>
            <div className="text-xs text-ink-subtle">
              {formatDateTime(e.created_at, locale)}
            </div>
            {e.note ? (
              <p className="mt-1 text-sm text-ink-muted">{e.note}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
