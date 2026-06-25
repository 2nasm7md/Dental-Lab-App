'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn, formatDateTime } from '@/lib/utils';
import type { AppNotification } from '@/lib/types/db';
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/server/actions/notifications';

interface Props {
  initial: AppNotification[];
  initialUnread: number;
  recipientUserId: string;
}

export function NotificationBell({ initial, initialUnread, recipientUserId }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`notifications-${recipientUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${recipientUserId}`,
        },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems((prev) => [n, ...prev].slice(0, 30));
          setUnread((u) => u + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${recipientUserId}`,
        },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems((prev) => prev.map((p) => (p.id === n.id ? n : p)));
          if (n.is_read) setUnread((u) => Math.max(0, u - 1));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [recipientUserId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const onItemClick = (n: AppNotification) => {
    setOpen(false);
    if (!n.is_read) {
      setItems((prev) =>
        prev.map((p) => (p.id === n.id ? { ...p, is_read: true } : p))
      );
      setUnread((u) => Math.max(0, u - 1));
      start(async () => {
        await markNotificationReadAction(n.id);
      });
    }
    if (n.case_id) router.push(`/cases/${n.case_id}`);
    else if ((n.payload as { connection_id?: string }).connection_id) {
      router.push('/connections');
    }
  };

  const markAll = () =>
    start(async () => {
      await markAllNotificationsReadAction();
      setItems((prev) => prev.map((p) => ({ ...p, is_read: true })));
      setUnread(0);
    });

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative size-9 rounded-xl border border-surface-border bg-white hover:bg-surface-muted grid place-items-center"
        aria-label={t('nav.notifications')}
      >
        <Bell className="size-5 text-ink-muted" />
        {unread > 0 ? (
          <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold grid place-items-center">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute end-0 mt-2 w-80 max-w-[90vw] card overflow-hidden z-30">
          <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
            <div className="font-semibold text-ink">{t('nav.notifications')}</div>
            <button
              type="button"
              onClick={markAll}
              disabled={pending || unread === 0}
              className="text-xs font-medium text-brand-700 disabled:opacity-50 inline-flex items-center gap-1"
            >
              <CheckCheck className="size-3.5" />
              {t('actions.markAllRead')}
            </button>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-sm text-ink-subtle text-center">
                {t('common.noResults')}
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onItemClick(n)}
                    className={cn(
                      'w-full text-start px-3 py-2.5 hover:bg-surface-muted flex gap-2 items-start',
                      !n.is_read && 'bg-brand-50/60'
                    )}
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full mt-1.5 shrink-0',
                        n.is_read ? 'bg-transparent' : 'bg-brand-600'
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">
                        {t(`notif.${n.type}`)}
                      </span>
                      <span className="block text-xs text-ink-subtle">
                        {(n.payload as { case_number?: string }).case_number
                          ? `#${(n.payload as { case_number: string }).case_number} · `
                          : ''}
                        {formatDateTime(n.created_at, locale)}
                      </span>
                      {(n.payload as { preview?: string }).preview ? (
                        <span className="block text-xs text-ink-muted truncate">
                          {(n.payload as { preview: string }).preview}
                        </span>
                      ) : null}
                    </span>
                    {n.is_read ? (
                      <Check className="size-3.5 text-ink-subtle mt-1 shrink-0" />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
          <Link
            href="/notifications"
            className="block text-center text-sm font-medium text-brand-700 py-2 border-t border-surface-border hover:bg-surface-muted"
            onClick={() => setOpen(false)}
          >
            {t('actions.viewAll')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
