'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/current-user';

export async function updateOrgSettingsAction(patch: {
  all_doctors_see_all_cases?: boolean;
  cost_tracking_enabled?: boolean;
  techs_see_unassigned?: boolean;
}) {
  const session = await getCurrentSession();
  if (!session?.organization) return { ok: false as const, error: 'no_org' };
  const supabase = createSupabaseServerClient();
  const newSettings = { ...session.organization.settings, ...patch };
  const { error } = await supabase
    .from('organizations')
    .update({ settings: newSettings })
    .eq('id', session.organization.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { ok: true as const };
}

export async function updateOrgProfileAction(patch: {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  currency?: string;
}) {
  const session = await getCurrentSession();
  if (!session?.organization) return { ok: false as const, error: 'no_org' };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('organizations')
    .update(patch)
    .eq('id', session.organization.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/settings');
  return { ok: true as const };
}
