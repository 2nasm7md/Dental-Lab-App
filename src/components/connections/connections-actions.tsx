'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, X, Copy } from 'lucide-react';
import {
  respondConnectionAction,
  createInvitationAction,
  requestConnectionAction,
} from '@/server/actions/connections';

export function PendingRow({
  row,
}: {
  row: {
    id: string;
    partner: { id: string; name: string; phone: string | null };
  };
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (accept: boolean) =>
    start(async () => {
      await respondConnectionAction(row.id, accept);
      router.refresh();
    });
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-surface-border bg-white">
      <div className="min-w-0">
        <div className="font-medium text-ink truncate">{row.partner.name}</div>
        {row.partner.phone ? (
          <div className="text-xs text-ink-subtle truncate">{row.partner.phone}</div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() => act(true)}
        >
          <Check className="size-4" />
          {t('actions.accept')}
        </button>
        <button
          className="btn-secondary"
          disabled={pending}
          onClick={() => act(false)}
        >
          <X className="size-4" />
          {t('actions.decline')}
        </button>
      </div>
    </div>
  );
}

export function Invite({ invitedType }: { invitedType: 'clinic' | 'lab' }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = () =>
    start(async () => {
      const r = await createInvitationAction({
        invitedOrgType: invitedType,
        email,
        phone,
      });
      if (r.ok) setLink(r.inviteUrl ?? null);
    });

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="input"
          placeholder={t('connections.inviteEmail')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          placeholder={t('connections.invitePhone')}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <button
        className="btn-primary"
        disabled={pending || (!email && !phone)}
        onClick={submit}
      >
        {t('connections.sendInvite')}
      </button>
      {link ? (
        <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-muted p-2">
          <code className="text-xs truncate flex-1">{link}</code>
          <button className="btn-secondary" onClick={copy}>
            <Copy className="size-4" />
            {copied ? t('connections.linkCopied') : t('actions.open')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ConnectButton({
  targetOrgId,
  disabled,
}: {
  targetOrgId: string;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-secondary"
      disabled={pending || disabled}
      onClick={() =>
        start(async () => {
          await requestConnectionAction(targetOrgId);
          router.refresh();
        })
      }
    >
      {disabled ? t('connections.requestSent') : t('actions.connect')}
    </button>
  );
}

