'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
import type { PaymentStatus } from '@/lib/types/db';
import { formatCurrency } from '@/lib/utils';
import { updateCasePaymentAction } from '@/server/actions/cases';

interface Props {
  caseId: string;
  initialPrice: number | null;
  initialStatus: PaymentStatus | null;
  currency: string;
  canEdit: boolean;
}

const ORDER: PaymentStatus[] = ['unpaid', 'partially_paid', 'paid'];

const TONE: Record<PaymentStatus, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partially_paid: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
};

export function CasePaymentEditor({
  caseId,
  initialPrice,
  initialStatus,
  currency,
  canEdit,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [price, setPrice] = useState<string>(initialPrice?.toString() ?? '');
  const [status, setStatus] = useState<PaymentStatus>(initialStatus ?? 'unpaid');
  const [error, setError] = useState<string | null>(null);

  const save = () =>
    start(async () => {
      setError(null);
      const r = await updateCasePaymentAction({
        caseId,
        price: price === '' ? null : Number(price),
        payment_status: status,
      });
      if (!r.ok) {
        setError(r.error ?? 'error');
        return;
      }
      setOpen(false);
      router.refresh();
    });

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-ink-subtle">{t('payment.price')}</div>
          <div className="text-base font-semibold text-ink tabular-nums">
            {initialPrice != null
              ? formatCurrency(initialPrice, currency)
              : '—'}
          </div>
          {initialStatus ? (
            <span className={`badge mt-1 ${TONE[initialStatus]}`}>
              {t(`payment.${initialStatus}`)}
            </span>
          ) : null}
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn-secondary"
          >
            <Pencil className="size-4" />
            {t('actions.save')}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">{t('payment.price')}</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="label">{t('payment.label')}</label>
        <div className="flex gap-2 flex-wrap">
          {ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`chip ${status === s ? 'chip-active' : ''}`}
            >
              {t(`payment.${s}`)}
            </button>
          ))}
        </div>
      </div>
      {error ? <div className="text-sm text-red-700">{error}</div> : null}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          {t('actions.cancel')}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={save}
          disabled={pending}
        >
          {t('actions.save')}
        </button>
      </div>
    </div>
  );
}
