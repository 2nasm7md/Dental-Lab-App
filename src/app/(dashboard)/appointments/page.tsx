import { getTranslations } from 'next-intl/server';
import { requireOnboarded } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import type {
  Appointment,
  AppointmentStatus,
  Doctor,
  VisitType,
} from '@/lib/types/db';
import { AppointmentsView } from './appointments-view';

interface SearchParams {
  doctor?: string;
  status?: AppointmentStatus;
  q?: string;
  date?: string;
}

export default async function AppointmentsPage(props: { searchParams: Promise<SearchParams> }) {
  const params = await props.searchParams;
  const session = await requireOnboarded();
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from('appointments')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .order('start_at', { ascending: true })
    .limit(500);

  if (params.doctor) query = query.eq('doctor_id', params.doctor);
  if (params.status) query = query.eq('status', params.status);

  if (params.date) {
    const day = new Date(params.date);
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    query = query.gte('start_at', day.toISOString()).lt('start_at', next.toISOString());
  }
  if (params.q) {
    query = query.or(
      `patient_name.ilike.%${params.q}%,patient_phone.ilike.%${params.q}%`
    );
  }

  const [appts, doctors, visitTypes] = await Promise.all([
    query,
    supabase.from('doctors').select('*').eq('tenant_id', session.tenantId).order('name'),
    supabase
      .from('visit_types')
      .select('*')
      .eq('tenant_id', session.tenantId)
      .order('name'),
  ]);

  const t = await getTranslations('appointments');

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />
      <AppointmentsView
        role={session.role}
        appointments={(appts.data ?? []) as Appointment[]}
        doctors={(doctors.data ?? []) as Doctor[]}
        visitTypes={(visitTypes.data ?? []) as VisitType[]}
        filters={params}
      />
    </div>
  );
}
