import { requireSession } from '@/lib/current-user';
import { AppShell } from '@/components/layout/app-shell';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { MessageBell } from '@/components/notifications/message-bell';
import {
  listMyNotifications,
  getUnreadCount,
  listMyMessages,
  getUnreadMessageCount,
} from '@/lib/queries/notifications';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  const [items, unread, messages, unreadMessages] = await Promise.all([
    listMyNotifications(),
    getUnreadCount(),
    listMyMessages(),
    getUnreadMessageCount(),
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
      messagesSlot={
        <MessageBell
          initial={messages}
          initialUnread={unreadMessages}
          recipientUserId={session.profile.id}
        />
      }
    >
      {children}
    </AppShell>
  );
}
