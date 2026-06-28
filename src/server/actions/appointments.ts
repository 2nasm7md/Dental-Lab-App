'use server';

import { revalidatePath } from 'next/cache';
import { requireOnboarded } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  type AppointmentCreateInput,
  type AppointmentUpdateInput,
} from '@/lib/validation/appointments';

export async function createAppointment(input: AppointmentCreateInput) {
  const session = await requireOnboarded();
  assertPermission(session.role, 'appointments.manage');
  const data = appointmentCreateSchema.parse(input);
  const supabase = await createSupabaseServerClient();

  const { data: visit, error: vErr } = await supabase
    .from('visit_types')
    .select('duration_minutes')
    .eq('id', data.visit_type_id)
    .eq('tenant_id', session.tenantId)
    .single();
  if (vErr || !visit) throw new Error('visit_type_not_found');

  const start = new Date(data.start_at);
  const end = new Date(start.getTime() + visit.duration_minutes * 60_000);

  const { error } = await supabase.from('appointments').insert({
    tenant_id: session.tenantId,
    doctor_id: data.doctor_id,
    visit_type_id: data.visit_type_id,
    patient_name: data.patient_name,
    patient_phone: data.patient_phone,
    patient_age: data.patient_age ?? null,
    patient_gender: data.patient_gender ?? null,
    patient_email: data.patient_email || null,
    notes: data.notes || null,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    status: 'confirmed',
  });
  if (error) {
    if (error.message.includes('appointments_no_overlap')) {
      throw new Error('slot_unavailable');
    }
    throw new Error(error.message);
  }
  revalidatePath('/appointments');
}

export async function updateAppointment(id: string, input: AppointmentUpdateInput) {
  const session = await requireOnboarded();
  assertPermission(session.role, 'appointments.manage');
  const data = appointmentUpdateSchema.parse(input);
  const supabase = await createSupabaseServerClient();

  const patch: Record<string, unknown> = {};
  if (data.status) patch.status = data.status;
  if (data.notes !== undefined) patch.notes = data.notes || null;

  if (data.start_at) {
    const { data: existing } = await supabase
      .from('appointments')
      .select('start_at, end_at')
      .eq('id', id)
      .eq('tenant_id', session.tenantId)
      .single();
    if (!existing) throw new Error('not_found');
    const duration = new Date(existing.end_at).getTime() - new Date(existing.start_at).getTime();
    const newStart = new Date(data.start_at);
    patch.start_at = newStart.toISOString();
    patch.end_at = new Date(newStart.getTime() + duration).toISOString();
  }

  const { error } = await supabase
    .from('appointments')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', session.tenantId);
  if (error) {
    if (error.message.includes('appointments_no_overlap')) {
      throw new Error('slot_unavailable');
    }
    throw new Error(error.message);
  }
  revalidatePath('/appointments');
}

export async function cancelAppointment(id: string) {
  return updateAppointment(id, { status: 'cancelled' });
}
