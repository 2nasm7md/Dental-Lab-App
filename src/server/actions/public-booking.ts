'use server';

import { z } from 'zod';
import { createSupabaseAnonClient } from '@/lib/supabase/anon';

const bookingSchema = z.object({
  tenant_slug: z.string().min(1),
  doctor_id: z.string().uuid(),
  visit_type_id: z.string().uuid(),
  start_at: z.string(),
  patient_name: z.string().min(2).max(120),
  patient_phone: z.string().min(4).max(30),
  patient_age: z.number().int().min(0).max(130).optional(),
  patient_gender: z.enum(['male', 'female']).optional(),
  patient_email: z.string().email().optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export async function publicBook(input: BookingInput) {
  const parsed = bookingSchema.parse(input);
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.rpc('book_appointment', {
    p_tenant_slug:   parsed.tenant_slug,
    p_doctor_id:     parsed.doctor_id,
    p_visit_type_id: parsed.visit_type_id,
    p_start_at:      parsed.start_at,
    p_patient_name:  parsed.patient_name,
    p_patient_phone: parsed.patient_phone,
    p_patient_age:   parsed.patient_age ?? null,
    p_patient_gender: parsed.patient_gender ?? null,
    p_patient_email: parsed.patient_email || '',
    p_notes:         parsed.notes || '',
  });
  if (error) {
    return { ok: false as const, error: extractError(error.message) };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true as const, appointmentId: row.appointment_id, startAt: row.start_at };
}

function extractError(msg: string): string {
  if (msg.includes('slot_unavailable')) return 'slot_unavailable';
  if (msg.includes('tenant_not_found_or_private')) return 'tenant_not_found';
  if (msg.includes('doctor_not_available')) return 'doctor_not_available';
  if (msg.includes('visit_type_not_available')) return 'visit_type_not_available';
  if (msg.includes('patient_name_required')) return 'patient_name_required';
  if (msg.includes('patient_phone_required')) return 'patient_phone_required';
  return 'booking_failed';
}

export async function publicLookup(slug: string, phone: string) {
  if (!phone || phone.length < 3) return [];
  const supabase = createSupabaseAnonClient();
  const { data } = await supabase.rpc('lookup_appointments_by_phone', {
    p_tenant_slug: slug,
    p_phone: phone.trim(),
  });
  return data ?? [];
}

export async function publicAvailability(
  slug: string,
  doctorId: string,
  visitTypeId: string,
  isoDate: string
) {
  const supabase = createSupabaseAnonClient();
  // Resolve the doctor's tenant + visit duration so we can compute slots client-safe.
  const [{ data: visit }, { data: tenantRow }] = await Promise.all([
    supabase
      .from('visit_types')
      .select('duration_minutes, tenant_id')
      .eq('id', visitTypeId)
      .single(),
    supabase.from('tenants').select('id').eq('slug', slug).eq('public', true).single(),
  ]);
  if (!visit || !tenantRow || visit.tenant_id !== tenantRow.id) return [];

  const date = new Date(isoDate);
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const [days, appts] = await Promise.all([
    supabase.from('schedule_days').select('*').eq('doctor_id', doctorId),
    supabase
      .from('appointments')
      .select('start_at,end_at,status')
      .eq('doctor_id', doctorId)
      .gte('start_at', dayStart.toISOString())
      .lt('start_at', dayEnd.toISOString()),
  ]);

  const { computeAvailableSlots } = await import('@/lib/availability');
  const slots = computeAvailableSlots({
    date,
    visitDurationMinutes: visit.duration_minutes,
    workingDays: (days.data ?? []) as never,
    // breaks and absences aren't readable by anon; the RPC will re-validate
    // and refuse a booking that hits one. The advisory lock + EXCLUDE
    // constraint together close the race window.
    breaks: [],
    absences: [],
    appointments: ((appts.data ?? []) as { start_at: string; end_at: string; status: string }[])
      .map((a) => ({
        id: '',
        tenant_id: '',
        doctor_id: doctorId,
        visit_type_id: '',
        patient_name: '',
        patient_phone: '',
        patient_age: null,
        patient_gender: null,
        patient_email: null,
        notes: null,
        status: a.status as never,
        start_at: a.start_at,
        end_at: a.end_at,
        created_at: '',
      })),
  });

  return slots.map((s) => ({
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
  }));
}
