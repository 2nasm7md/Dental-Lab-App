'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Building2 } from 'lucide-react';
import { ConnectionsActions } from './connections-actions';

interface OrgRow {
  id: string;
  name: string;
  type: 'clinic' | 'lab';
  phone: string | null;
  email: string | null;
  logo_url: string | null;
}

interface Props {
  orgs: OrgRow[];
  linkedIds: string[];
  pendingIds: string[];
}

export function ConnectionsDirectory({ orgs, linkedIds, pendingIds }: Props) {
  const t = useTranslations();
  const [q, setQ] = useState('');

  const linked = useMemo(() => new Set(linkedIds), [linkedIds]);
  const pending = useMemo(() => new Set(pendingIds), [pendingIds]);

  const filtered = useMemo(() => {
    if (!q) return orgs;
    const lc = q.toLowerCase();
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(lc) ||
        (o.phone?.toLowerCase().includes(lc) ?? false)
    );
  }, [orgs, q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-ink-subtle" />
        <input
          className="input ps-9"
          placeholder={t('connections.searchPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((o) => (
          <div key={o.id} className="card p-4 flex items-center gap-3">
            <div className="size-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center">
              <Building2 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ink truncate">{o.name}</div>
              {o.phone ? (
                <div className="text-xs text-ink-subtle truncate">{o.phone}</div>
              ) : null}
            </div>
            {linked.has(o.id) ? (
              <span className="badge bg-emerald-100 text-emerald-800">
                {t('actions.connect')}
              </span>
            ) : (
              <ConnectionsActions.ConnectButton
                targetOrgId={o.id}
                disabled={pending.has(o.id)}
              />
            )}
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="text-sm text-ink-subtle col-span-full">
            {t('common.noResults')}
          </div>
        ) : null}
      </div>
    </div>
  );
}
