'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Transition } from '@/lib/case-state-machine';
import { transitionCaseAction } from '@/server/actions/cases';

interface Option {
  id: string;
  name: string;
}

interface Props {
  caseId: string;
  transitions: Transition[];
  cancellable: boolean;
  side: 'clinic' | 'lab';
  techs: Option[];
  partners: Option[];
}

export function CaseActions({
  caseId,
  transitions,
  cancellable,
  side,
  techs,
  partners,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState<string>('');
  const [showDecline, setShowDecline] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [showAccept, setShowAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (
    action: Parameters<typeof transitionCaseAction>[0]['action'],
    extra: Partial<Parameters<typeof transitionCaseAction>[0]> = {}
  ) => {
    setError(null);
    start(async () => {
      const r = await transitionCaseAction({ caseId, action, ...extra });
      if (!r.ok) setError(r.error ?? 'error');
      else {
        setShowDecline(false);
        setShowReassign(false);
        setShowAccept(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {error ? <div className="text-sm text-red-700">{error}</div> : null}
      <div className="flex flex-wrap gap-2 justify-end">
        {transitions.map((tr) => {
          if (tr.to === 'declined') {
            return (
              <button
                key={tr.to}
                className="btn-danger"
                disabled={pending}
                onClick={() => setShowDecline(true)}
              >
                {t(tr.labelKey)}
              </button>
            );
          }
          if (tr.from === 'declined' && tr.to === 'pending') {
            return (
              <button
                key={tr.to + tr.from}
                className="btn-primary"
                disabled={pending}
                onClick={() => setShowReassign(true)}
              >
                {t(tr.labelKey)}
              </button>
            );
          }
          if (tr.to === 'accepted' && side === 'lab') {
            return (
              <button
                key={tr.to}
                className="btn-primary"
                disabled={pending}
                onClick={() => setShowAccept(true)}
              >
                {t(tr.labelKey)}
              </button>
            );
          }
          if (tr.from === 'draft' && tr.to === 'pending') {
            return (
              <button
                key={tr.to + tr.from}
                className="btn-primary"
                disabled={pending}
                onClick={() => run('send')}
              >
                {t(tr.labelKey)}
              </button>
            );
          }
          return (
            <button
              key={tr.from + tr.to}
              className="btn-primary"
              disabled={pending}
              onClick={() => run('advance', { to: tr.to })}
            >
              {t(tr.labelKey)}
            </button>
          );
        })}
        {cancellable ? (
          <button
            className="btn-secondary"
            disabled={pending}
            onClick={() => run('cancel')}
          >
            {t('actions.cancel')}
          </button>
        ) : null}
      </div>

      {showAccept ? (
        <div className="card p-3 w-full max-w-sm space-y-2">
          <label className="label">{t('actions.assign')}</label>
          <select
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">{t('common.optional')}</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setShowAccept(false)}>
              {t('actions.cancel')}
            </button>
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() =>
                run('accept', { technicianId: reason || undefined })
              }
            >
              {t('actions.accept')}
            </button>
          </div>
        </div>
      ) : null}

      {showDecline ? (
        <div className="card p-3 w-full max-w-sm space-y-2">
          <label className="label">{t('case.declineReason')}</label>
          <textarea
            className="input min-h-[80px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setShowDecline(false)}>
              {t('actions.cancel')}
            </button>
            <button
              className="btn-danger"
              disabled={pending || !reason.trim()}
              onClick={() => run('decline', { reason })}
            >
              {t('actions.decline')}
            </button>
          </div>
        </div>
      ) : null}

      {showReassign ? (
        <div className="card p-3 w-full max-w-sm space-y-2">
          <label className="label">{t('case.selectLab')}</label>
          <select
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">—</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setShowReassign(false)}>
              {t('actions.cancel')}
            </button>
            <button
              className="btn-primary"
              disabled={pending || !reason}
              onClick={() => run('reassign', { newLabId: reason })}
            >
              {t('actions.reassign')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
