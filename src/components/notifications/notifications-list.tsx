'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { CheckCheck } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import type { AppNotification } from '@/lib/types/db';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/server/actions/notifications';

interface Props {
  initial: AppNotification[];
  recipientUserId: string;
}

export function NotificationsList({ initial, recipientUserId }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const [items, setItems] = useState(initial);
  const [pending, start] = useTransition();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`notifications-page-${recipientUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${recipientUserId}`,
        },
        (payload) =>
          setItems((prev) => {
            const n = payload.new as AppNotification;
            if (prev.some((p) => p.id === n.id)) return prev;
            return [n, ...prev];
          })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [recipientUserId]);

  const markRead = (n: AppNotification) => {
    if (n.is_read) return;
    setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, is_read: true } : p)));
    start(async () => {
      await markNotificationReadAction(n.id);
    });
  };

  const markAll = () => {
    setItems((prev) => prev.map((p) => ({ ...p, is_read: true })));
    start(async () => {
      await markAllNotificationsReadAction();
    });
  };

  const unread = items.filter((i) => !i.is_read).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          onClick={markAll}
          disabled={pending || unread === 0}
          className="btn-secondary disabled:opacity-50"
        >
          <CheckCheck className="size-4" />
          {t('actions.markAllRead')}
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((n) => {
          const payload = n.payload as Record<string, string>;
          const href = n.case_id
            ? `/cases/${n.case_id}`
            : payload.connection_id
              ? '/connections'
              : null;
          const inner = (
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'size-2 rounded-full mt-2 shrink-0',
                  n.is_read ? 'bg-transparent' : 'bg-brand-600'
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink">{t(`notif.${n.type}`)}</div>
                <div className="text-xs text-ink-subtle">
                  {payload.case_number ? `#${payload.case_number} · ` : ''}
                  {formatDateTime(n.created_at, locale)}
                </div>
                {payload.preview ? (
                  <div className="text-sm text-ink-muted mt-1 truncate">
                    {payload.preview}
                  </div>
                ) : null}
              </div>
            </div>
          );
          return (
            <li
              key={n.id}
              className={cn(
                'card p-4 transition-opacity',
                n.is_read && 'opacity-70'
              )}
            >
              {href ? (
                <Link href={href} onClick={() => markRead(n)}>
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => markRead(n)}
                  className="text-start w-full"
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
