'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, Building2, CheckCircle2, Clock } from 'lucide-react';
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
  initialQuery: string;
  ownOrgId: string;
}

export function ConnectionsDirectory({
  orgs,
  linkedIds,
  pendingIds,
  initialQuery,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQuery);
  const [, start] = useTransition();

  const linked = new Set(linkedIds);
  const pending = new Set(pendingIds);

  // Debounce URL updates so each keystroke doesn't trigger a server roundtrip.
  useEffect(() => {
    const next = new URLSearchParams(params.toString());
    if (q) next.set('q', q);
    else next.delete('q');
    const target = `${pathname}?${next.toString()}`;
    const timer = window.setTimeout(() => {
      start(() => router.replace(target));
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pathname]);

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

      {orgs.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-subtle">
          {q ? t('common.noResults') : t('connections.directoryEmpty')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {orgs.map((o) => {
            const isLinked = linked.has(o.id);
            const isPending = pending.has(o.id);
            return (
              <div key={o.id} className="card p-4 flex items-center gap-3">
                <div className="size-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                  <Building2 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink truncate">{o.name}</div>
                  {o.phone ? (
                    <div className="text-xs text-ink-subtle truncate">
                      {o.phone}
                    </div>
                  ) : null}
                </div>
                {isLinked ? (
                  <span className="badge bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="size-3.5" />
                    {t('connections.connected')}
                  </span>
                ) : isPending ? (
                  <span className="badge bg-amber-100 text-amber-800">
                    <Clock className="size-3.5" />
                    {t('connections.requestSent')}
                  </span>
                ) : (
                  <ConnectionsActions.ConnectButton targetOrgId={o.id} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
