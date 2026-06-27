'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { MessageSquare, CheckCheck } from 'lucide-react';
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

export function MessageBell({ initial, initialUnread, recipientUserId }: Props) {
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
      .channel(`messages-${recipientUserId}`)
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
          if (n.type !== 'new_message') return;
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
          if (n.type !== 'new_message') return;
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
    if (n.case_id) router.push(`/cases/${n.case_id}#chat`);
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
        aria-label={t('nav.messages')}
      >
        <MessageSquare className="size-5 text-ink-muted" />
        {unread > 0 ? (
          <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold grid place-items-center">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute end-0 mt-2 w-80 max-w-[90vw] card overflow-hidden z-30">
          <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
            <div className="font-semibold text-ink">{t('nav.messages')}</div>
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
              items.map((n) => {
                const p = n.payload as {
                  sender_name?: string;
                  sender_org?: string;
                  patient_name?: string;
                  case_number?: string;
                  preview?: string;
                };
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onItemClick(n)}
                      className={cn(
                        'w-full text-start px-3 py-2.5 hover:bg-surface-muted flex gap-2 items-start',
                        !n.is_read && 'bg-blue-50/60'
                      )}
                    >
                      <span
                        className={cn(
                          'size-2 rounded-full mt-1.5 shrink-0',
                          n.is_read ? 'bg-transparent' : 'bg-blue-600'
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink truncate">
                          {p.sender_name ?? t('notif.new_message')}
                          {p.sender_org ? (
                            <span className="font-normal text-ink-muted"> · {p.sender_org}</span>
                          ) : null}
                        </span>
                        {p.patient_name || p.case_number ? (
                          <span className="block text-xs text-ink-muted">
                            {p.case_number ? `#${p.case_number}` : ''}
                            {p.case_number && p.patient_name ? ' · ' : ''}
                            {p.patient_name ?? ''}
                          </span>
                        ) : null}
                        {p.preview ? (
                          <span className="block text-xs text-ink-subtle truncate">
                            {p.preview.slice(0, 50)}
                          </span>
                        ) : null}
                        <span className="block text-[10px] text-ink-subtle mt-0.5">
                          {formatDateTime(n.created_at, locale)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
