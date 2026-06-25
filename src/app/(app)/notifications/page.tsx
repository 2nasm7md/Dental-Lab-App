import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateTime } from '@/lib/utils';
import type { AppNotification } from '@/lib/types/db';

export default async function NotificationsPage() {
  const t = await getTranslations();
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  const items = (data ?? []) as AppNotification[];

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold text-ink">{t('nav.notifications')}</h1>
      {items.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-8" />}
          title={t('common.noResults')}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const payload = n.payload as Record<string, string>;
            return (
              <li
                key={n.id}
                className={`card p-4 flex items-center justify-between ${
                  n.is_read ? 'opacity-70' : ''
                }`}
              >
                <div>
                  <div className="font-medium text-ink">
                    {t(`notif.${n.type}`)}
                  </div>
                  <div className="text-xs text-ink-subtle">
                    {payload.case_number ? `#${payload.case_number} · ` : ''}
                    {formatDateTime(n.created_at)}
                  </div>
                </div>
                {n.case_id ? (
                  <Link href={`/cases/${n.case_id}`} className="btn-secondary">
                    {t('actions.open')}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
