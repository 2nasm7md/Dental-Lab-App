'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/current-user';

export async function requestConnectionAction(targetOrgId: string) {
  const session = await getCurrentSession();
  if (!session?.profile?.organization_id) return { ok: false as const, error: 'no_org' };
  const supabase = createSupabaseServerClient();
  const myOrg = session.organization!;
  const isClinic = myOrg.type === 'clinic';
  const clinicId = isClinic ? myOrg.id : targetOrgId;
  const labId = isClinic ? targetOrgId : myOrg.id;

  const { error } = await supabase.from('connections').insert({
    clinic_org_id: clinicId,
    lab_org_id: labId,
    requested_by: session.profile.id,
    status: 'pending',
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/connections');
  return { ok: true as const };
}

export async function respondConnectionAction(connectionId: string, accept: boolean) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc('respond_connection', {
    p_connection_id: connectionId,
    p_accept: accept,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/connections');
  return { ok: true as const };
}

export async function createInvitationAction(args: {
  invitedOrgType: 'clinic' | 'lab';
  email?: string;
  phone?: string;
}) {
  const session = await getCurrentSession();
  if (!session?.profile?.organization_id) return { ok: false as const, error: 'no_org' };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      from_org_id: session.profile.organization_id,
      invited_email: args.email || null,
      invited_phone: args.phone || null,
      invited_org_type: args.invitedOrgType,
      created_by: session.profile.id,
    })
    .select('token')
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? 'failed' };
  revalidatePath('/connections');
  return {
    ok: true as const,
    inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/invite/${data.token}`,
  };
}
