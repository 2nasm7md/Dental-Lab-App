'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCallback } from 'react';

const TABS = [
  { key: 'all', label: 'dashboard.all' },
  { key: 'active', label: 'dashboard.active' },
  { key: 'attention', label: 'dashboard.needsAttention' },
  { key: 'closed', label: 'dashboard.closed' },
] as const;

export function CaseFiltersBar() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get('status') ?? 'all';
  const q = params.get('q') ?? '';

  const update = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v) next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router]
  );

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() =>
              update({ status: tab.key === 'all' ? undefined : tab.key })
            }
            className={cn('chip', current === tab.key && 'chip-active')}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>
      <div className="md:ms-auto md:w-72 relative">
        <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-ink-subtle" />
        <input
          defaultValue={q}
          onChange={(e) => update({ q: e.target.value || undefined })}
          placeholder={t('actions.search')}
          className="input ps-9"
        />
      </div>
    </div>
  );
}
