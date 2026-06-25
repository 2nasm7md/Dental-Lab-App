'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/current-user';
import type { UserRole } from '@/lib/types/db';

const AddMemberSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(['clinic_admin', 'doctor', 'secretary', 'lab_admin', 'technician']),
  password: z.string().min(8).optional(),
  assistsDoctorIds: z.array(z.string().uuid()).optional(),
});

function randomPassword() {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out + '!';
}

function rolesForOrgType(type: 'clinic' | 'lab'): UserRole[] {
  return type === 'clinic'
    ? ['clinic_admin', 'doctor', 'secretary']
    : ['lab_admin', 'technician'];
}

export async function addTeamMemberAction(input: z.infer<typeof AddMemberSchema>) {
  const session = await requireSession();
  if (!['clinic_admin', 'lab_admin'].includes(session.profile.role)) {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = AddMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' };
  const v = parsed.data;

  if (!rolesForOrgType(session.organization.type).includes(v.role)) {
    return { ok: false as const, error: 'role_not_for_org_type' };
  }

  const admin = createSupabaseServiceClient();
  const password = v.password || randomPassword();

  // 1) create the auth user (email-confirmed so they can log in immediately)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: v.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: v.fullName },
  });
  if (createErr || !created.user) {
    return { ok: false as const, error: createErr?.message ?? 'create_failed' };
  }

  // 2) create / update the profile in the same org
  const { error: profileErr } = await admin.from('users').upsert(
    {
      id: created.user.id,
      organization_id: session.organization.id,
      role: v.role,
      full_name: v.fullName,
      phone: v.phone || null,
      assists_doctor_ids: v.assistsDoctorIds ?? [],
      is_active: true,
    },
    { onConflict: 'id' }
  );
  if (profileErr) {
    return { ok: false as const, error: profileErr.message };
  }

  revalidatePath('/team');
  return {
    ok: true as const,
    userId: created.user.id,
    email: v.email,
    password,
    generatedPassword: !v.password,
  };
}

export async function updateMemberRoleAction(args: {
  userId: string;
  role: UserRole;
  assistsDoctorIds?: string[];
}) {
  const session = await requireSession();
  if (!['clinic_admin', 'lab_admin'].includes(session.profile.role)) {
    return { ok: false as const, error: 'forbidden' };
  }
  if (!rolesForOrgType(session.organization.type).includes(args.role)) {
    return { ok: false as const, error: 'role_not_for_org_type' };
  }
  const admin = createSupabaseServiceClient();
  const { error } = await admin
    .from('users')
    .update({
      role: args.role,
      assists_doctor_ids: args.assistsDoctorIds ?? [],
    })
    .eq('id', args.userId)
    .eq('organization_id', session.organization.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/team');
  return { ok: true as const };
}

export async function deactivateMemberAction(userId: string) {
  const session = await requireSession();
  if (!['clinic_admin', 'lab_admin'].includes(session.profile.role)) {
    return { ok: false as const, error: 'forbidden' };
  }
  if (userId === session.profile.id) {
    return { ok: false as const, error: 'cannot_deactivate_self' };
  }
  const admin = createSupabaseServiceClient();
  const { error } = await admin
    .from('users')
    .update({ is_active: false })
    .eq('id', userId)
    .eq('organization_id', session.organization.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/team');
  return { ok: true as const };
}

export async function reactivateMemberAction(userId: string) {
  const session = await requireSession();
  if (!['clinic_admin', 'lab_admin'].includes(session.profile.role)) {
    return { ok: false as const, error: 'forbidden' };
  }
  const admin = createSupabaseServiceClient();
  const { error } = await admin
    .from('users')
    .update({ is_active: true })
    .eq('id', userId)
    .eq('organization_id', session.organization.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/team');
  return { ok: true as const };
}
