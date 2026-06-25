'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Send } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import type { CaseMessage } from '@/lib/types/db';
import { postCaseMessageAction } from '@/server/actions/cases';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface Props {
  caseId: string;
  initial: CaseMessage[];
  currentUserId: string;
}

export function CaseChat({ caseId, initial, currentUserId }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const [messages, setMessages] = useState(initial);
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`case-messages-${caseId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'case_messages',
          filter: `case_id=eq.${caseId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as CaseMessage).id)
              ? prev
              : [...prev, payload.new as CaseMessage]
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseId]);

  const send = () => {
    const text = body.trim();
    if (!text) return;
    setBody('');
    start(async () => {
      const r = await postCaseMessageAction({ caseId, body: text });
      if (!r.ok) {
        setBody(text);
      }
    });
  };

  return (
    <div className="flex flex-col h-[420px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pe-1">
        {messages.length === 0 ? (
          <div className="grid place-items-center h-full text-sm text-ink-subtle">
            {t('common.noResults')}
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div
                key={m.id}
                className={cn('flex', mine ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-card',
                    mine
                      ? 'bg-brand-600 text-white rounded-ee-sm'
                      : 'bg-white border border-surface-border text-ink rounded-es-sm'
                  )}
                >
                  <div className="whitespace-pre-line break-words">{m.body}</div>
                  <div
                    className={cn(
                      'mt-1 text-[10px]',
                      mine ? 'text-brand-100' : 'text-ink-subtle'
                    )}
                  >
                    {formatDateTime(m.created_at, locale)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="input"
          placeholder="…"
        />
        <button
          className="btn-primary"
          onClick={send}
          disabled={pending || !body.trim()}
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}
