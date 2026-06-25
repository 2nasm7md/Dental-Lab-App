import { getTranslations } from 'next-intl/server';
import { Bell } from 'lucide-react';
import { requireSession } from '@/lib/current-user';
import { listMyNotifications } from '@/lib/queries/notifications';
import { EmptyState } from '@/components/ui/empty-state';
import { NotificationsList } from '@/components/notifications/notifications-list';

export default async function NotificationsPage() {
  const session = await requireSession();
  const t = await getTranslations();
  const items = await listMyNotifications(100);

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold text-ink">{t('nav.notifications')}</h1>
      {items.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-8" />}
          title={t('common.noResults')}
        />
      ) : (
        <NotificationsList initial={items} recipientUserId={session.profile.id} />
      )}
    </div>
  );
}
