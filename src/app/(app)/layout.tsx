import { requireSession } from '@/lib/current-user';
import { AppShell } from '@/components/layout/app-shell';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { listMyNotifications, getUnreadCount } from '@/lib/queries/notifications';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  const [items, unread] = await Promise.all([
    listMyNotifications(),
    getUnreadCount(),
  ]);

  return (
    <AppShell
      session={session}
      notificationsSlot={
        <NotificationBell
          initial={items}
          initialUnread={unread}
          recipientUserId={session.profile.id}
        />
      }
    >
      {children}
    </AppShell>
  );
}
