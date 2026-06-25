import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, Building2, Calendar, FileText, MessageSquare, User } from 'lucide-react';
import { getCurrentSession } from '@/lib/current-user';
import { getCaseById } from '@/lib/queries/cases';
import { getCaseHistory, getCaseMessages } from '@/lib/queries/case-detail';
import {
  listActivePartners,
  listLabTechnicians,
} from '@/lib/queries/connections';
import { sideOfOrgType, availableTransitions, canCancel } from '@/lib/case-state-machine';
import { StatusBadge } from '@/components/ui/status-badge';
import { CaseTimeline } from '@/components/cases/case-timeline';
import { CaseActions } from '@/components/cases/case-actions';
import { CaseChat } from '@/components/cases/case-chat';
import { formatDate, formatCurrency } from '@/lib/utils';

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
  const session = (await getCurrentSession())!;
  const t = await getTranslations();
  const side = sideOfOrgType(session.organization!.type);

  const c = await getCaseById(params.id);
  if (!c) notFound();

  const [history, messages, partners, techs] = await Promise.all([
    getCaseHistory(c.id),
    getCaseMessages(c.id),
    side === 'clinic'
      ? listActivePartners(session.organization!.id, 'clinic')
      : Promise.resolve([]),
    side === 'lab'
      ? listLabTechnicians(session.organization!.id)
      : Promise.resolve([]),
  ]);

  const transitions = availableTransitions(c.status, {
    side,
    role: session.profile!.role!,
    isAssignedTech: c.assigned_technician_id === session.profile!.id,
  });
  const cancellable = canCancel(c.status, { side, role: session.profile!.role! });

  const counterPartyLabel = side === 'clinic' ? t('case.lab') : t('case.clinic');
  const counterPartyName = side === 'clinic' ? c.lab?.name : c.clinic?.name;

  const costTrackingEnabled =
    (session.organization!.settings as { cost_tracking_enabled?: boolean })
      ?.cost_tracking_enabled !== false;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/cases" className="btn-ghost">
          <ArrowLeft className="size-4" />
          {t('actions.back')}
        </Link>
      </div>

      <header className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm text-ink-subtle">{c.case_number}</div>
            <h1 className="text-2xl font-bold text-ink">
              {c.patient_name || c.patient_ref || t('case.patient')}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={c.status} />
              {c.due_date ? (
                <span className="badge bg-slate-100 text-slate-700">
                  <Calendar className="size-3" />
                  {formatDate(c.due_date)}
                </span>
              ) : null}
            </div>
          </div>
          <CaseActions
            caseId={c.id}
            transitions={transitions}
            cancellable={cancellable}
            side={side}
            techs={techs.map((t) => ({ id: t.id, name: t.full_name }))}
            partners={partners.map((p) => ({ id: p.org.id, name: p.org.name }))}
          />
        </div>

        {c.decline_reason ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <div className="font-semibold">{t('case.declineReason')}</div>
            {c.decline_reason}
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="card p-5">
            <h2 className="font-semibold text-ink mb-3">{t('case.restoration')}</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Item k={t('case.restoration')} v={c.restoration_type ? t(`restoration.${c.restoration_type}`) : '—'} />
              <Item k={t('case.material')} v={c.material ? t(`material.${c.material}`) : '—'} />
              <Item k={t('case.teeth')} v={c.tooth_numbers.length ? c.tooth_numbers.join(', ') : '—'} />
              <Item k={t('case.shade')} v={c.shade ?? '—'} />
              <Item k={counterPartyLabel} v={counterPartyName ?? '—'} icon={<Building2 className="size-4" />} />
              <Item k={t('case.doctor')} v={c.owner_doctor?.full_name ?? '—'} icon={<User className="size-4" />} />
              {c.technician ? (
                <Item k={t('case.technician')} v={c.technician.full_name} icon={<User className="size-4" />} />
              ) : null}
              {costTrackingEnabled && c.price != null ? (
                <Item
                  k={t('payment.price')}
                  v={formatCurrency(c.price, c.currency ?? 'USD')}
                />
              ) : null}
            </dl>
            {c.doctor_notes ? (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-ink-subtle">
                  {t('case.notes')}
                </div>
                <p className="mt-1 text-sm text-ink whitespace-pre-line">
                  {c.doctor_notes}
                </p>
              </div>
            ) : null}
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="size-5 text-brand-600" />
              <h2 className="font-semibold text-ink">{t('case.messages')}</h2>
            </div>
            <CaseChat
              caseId={c.id}
              initial={messages}
              currentUserId={session.profile!.id}
            />
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="size-5 text-brand-600" />
              <h2 className="font-semibold text-ink">{t('case.timeline')}</h2>
            </div>
            <CaseTimeline entries={history} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function Item({ k, v, icon }: { k: string; v: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-subtle flex items-center gap-1.5">
        {icon}
        {k}
      </dt>
      <dd className="text-sm text-ink mt-0.5">{v}</dd>
    </div>
  );
}
