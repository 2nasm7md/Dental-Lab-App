'use server';

import { revalidatePath } from 'next/cache';
import { requireOnboarded } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { visitTypeSchema, type VisitTypeInput } from '@/lib/validation/visit-types';

export async function createVisitType(input: VisitTypeInput) {
  const session = await requireOnboarded();
  assertPermission(session.role, 'visit_types.manage');
  const data = visitTypeSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('visit_types').insert({
    tenant_id: session.tenantId,
    ...data,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/visit-types');
}

export async function updateVisitType(id: string, input: VisitTypeInput) {
  const session = await requireOnboarded();
  assertPermission(session.role, 'visit_types.manage');
  const data = visitTypeSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('visit_types')
    .update(data)
    .eq('id', id)
    .eq('tenant_id', session.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/visit-types');
}

export async function deleteVisitType(id: string) {
  const session = await requireOnboarded();
  assertPermission(session.role, 'visit_types.manage');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('visit_types')
    .delete()
    .eq('id', id)
    .eq('tenant_id', session.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/visit-types');
}
