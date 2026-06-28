'use server';

import { revalidatePath } from 'next/cache';
import { requireOnboarded } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  scheduleDaySchema,
  scheduleBreakSchema,
  scheduleAbsenceSchema,
  type ScheduleDayInput,
  type ScheduleAbsenceInput,
} from '@/lib/validation/schedules';

async function ctx() {
  const session = await requireOnboarded();
  assertPermission(session.role, 'schedules.manage');
  const supabase = await createSupabaseServerClient();
  return { session, supabase };
}

export async function createScheduleDay(input: ScheduleDayInput) {
  const { session, supabase } = await ctx();
  const data = scheduleDaySchema.parse(input);
  const { error } = await supabase
    .from('schedule_days')
    .insert({ tenant_id: session.tenantId, ...data });
  if (error) throw new Error(error.message);
  revalidatePath('/schedules');
}

export async function deleteScheduleDay(id: string) {
  const { session, supabase } = await ctx();
  const { error } = await supabase
    .from('schedule_days')
    .delete()
    .eq('id', id)
    .eq('tenant_id', session.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/schedules');
}

export async function createScheduleBreak(input: ScheduleDayInput) {
  const { session, supabase } = await ctx();
  const data = scheduleBreakSchema.parse(input);
  const { error } = await supabase
    .from('schedule_breaks')
    .insert({ tenant_id: session.tenantId, ...data });
  if (error) throw new Error(error.message);
  revalidatePath('/schedules');
}

export async function deleteScheduleBreak(id: string) {
  const { session, supabase } = await ctx();
  const { error } = await supabase
    .from('schedule_breaks')
    .delete()
    .eq('id', id)
    .eq('tenant_id', session.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/schedules');
}

export async function createScheduleAbsence(input: ScheduleAbsenceInput) {
  const { session, supabase } = await ctx();
  const data = scheduleAbsenceSchema.parse(input);
  const { error } = await supabase.from('schedule_absences').insert({
    tenant_id: session.tenantId,
    doctor_id: data.doctor_id,
    kind: data.kind,
    start_at: data.start_at,
    end_at: data.end_at,
    reason: data.reason || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/schedules');
}

export async function deleteScheduleAbsence(id: string) {
  const { session, supabase } = await ctx();
  const { error } = await supabase
    .from('schedule_absences')
    .delete()
    .eq('id', id)
    .eq('tenant_id', session.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/schedules');
}
