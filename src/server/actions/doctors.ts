'use server';

import { revalidatePath } from 'next/cache';
import { requireOnboarded } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { doctorSchema, type DoctorInput } from '@/lib/validation/doctors';

export async function createDoctor(input: DoctorInput) {
  const session = await requireOnboarded();
  assertPermission(session.role, 'doctors.manage');
  const data = doctorSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('doctors').insert({
    tenant_id: session.tenantId,
    name: data.name,
    specialty: data.specialty || null,
    photo_url: data.photo_url || null,
    bio: data.bio || null,
    active: data.active,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/doctors');
}

export async function updateDoctor(id: string, input: DoctorInput) {
  const session = await requireOnboarded();
  assertPermission(session.role, 'doctors.manage');
  const data = doctorSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('doctors')
    .update({
      name: data.name,
      specialty: data.specialty || null,
      photo_url: data.photo_url || null,
      bio: data.bio || null,
      active: data.active,
    })
    .eq('id', id)
    .eq('tenant_id', session.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/doctors');
}

export async function setDoctorActive(id: string, active: boolean) {
  const session = await requireOnboarded();
  assertPermission(session.role, 'doctors.manage');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('doctors')
    .update({ active })
    .eq('id', id)
    .eq('tenant_id', session.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/doctors');
}

export async function deleteDoctor(id: string) {
  const session = await requireOnboarded();
  assertPermission(session.role, 'doctors.manage');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('doctors')
    .delete()
    .eq('id', id)
    .eq('tenant_id', session.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/doctors');
}
