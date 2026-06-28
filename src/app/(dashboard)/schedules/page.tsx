import { getTranslations } from 'next-intl/server';
import { requireOnboarded } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import type { Doctor, ScheduleAbsence, ScheduleBreak, ScheduleDay } from '@/lib/types/db';
import { SchedulesManager } from './schedules-manager';

export default async function SchedulesPage() {
  const session = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const [doctors, days, breaks, absences] = await Promise.all([
    supabase
      .from('doctors')
      .select('*')
      .eq('tenant_id', session.tenantId)
      .order('name'),
    supabase
      .from('schedule_days')
      .select('*')
      .eq('tenant_id', session.tenantId)
      .order('weekday'),
    supabase
      .from('schedule_breaks')
      .select('*')
      .eq('tenant_id', session.tenantId)
      .order('weekday'),
    supabase
      .from('schedule_absences')
      .select('*')
      .eq('tenant_id', session.tenantId)
      .order('start_at', { ascending: false }),
  ]);
  const t = await getTranslations('schedules');

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />
      <SchedulesManager
        role={session.role}
        doctors={(doctors.data ?? []) as Doctor[]}
        days={(days.data ?? []) as ScheduleDay[]}
        breaks={(breaks.data ?? []) as ScheduleBreak[]}
        absences={(absences.data ?? []) as ScheduleAbsence[]}
      />
    </div>
  );
}
