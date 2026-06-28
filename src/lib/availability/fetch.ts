import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import type {
  Appointment,
  ScheduleAbsence,
  ScheduleBreak,
  ScheduleDay,
} from '@/lib/types/db';
import { computeAvailableSlots, type AvailableSlot } from './index';

interface FetchArgs {
  tenantId: string;
  doctorId: string;
  date: Date;
  visitDurationMinutes: number;
}

/**
 * Authenticated availability: used from server actions in the dashboard.
 * Relies on RLS — the caller's session must be a member of `tenantId`.
 */
export async function fetchAvailability(args: FetchArgs): Promise<AvailableSlot[]> {
  const supabase = await createSupabaseServerClient();
  return runFetch(supabase, args);
}

/**
 * Anonymous availability for the public booking flow. Uses the anon key —
 * RLS still applies and allows reads of schedule_days only.
 *
 * Note: schedule_breaks and schedule_absences are NOT readable by anon;
 * we resolve them via the SECURITY DEFINER booking RPC at submit time
 * (and via doctor_id-scoped advisory locks against races).  The public
 * UI therefore can render *candidate* slots that are then re-validated.
 */
export async function fetchPublicAvailability(args: FetchArgs): Promise<AvailableSlot[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  return runFetch(supabase, args);
}

async function runFetch(
  // We accept the loosest possible client type so both auth + anon variants share the same code path.
  supabase: any,
  { doctorId, date, visitDurationMinutes }: FetchArgs
): Promise<AvailableSlot[]> {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const [days, breaks, absences, appts] = await Promise.all([
    supabase.from('schedule_days').select('*').eq('doctor_id', doctorId),
    supabase.from('schedule_breaks').select('*').eq('doctor_id', doctorId),
    supabase
      .from('schedule_absences')
      .select('*')
      .eq('doctor_id', doctorId)
      .lte('start_at', dayEnd.toISOString())
      .gte('end_at', dayStart.toISOString()),
    supabase
      .from('appointments')
      .select('*')
      .eq('doctor_id', doctorId)
      .gte('start_at', dayStart.toISOString())
      .lt('start_at', dayEnd.toISOString()),
  ]);

  return computeAvailableSlots({
    date,
    visitDurationMinutes,
    workingDays: (days.data ?? []) as ScheduleDay[],
    breaks: (breaks.data ?? []) as ScheduleBreak[],
    absences: (absences.data ?? []) as ScheduleAbsence[],
    appointments: (appts.data ?? []) as Appointment[],
  });
}
