import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Role, TenantUser } from '@/lib/types/db';

const ACTIVE_TENANT_COOKIE = 'dt_active_tenant';

export interface SessionContext {
  userId: string;
  email: string;
  tenantId: string;
  role: Role;
  membership: TenantUser;
  memberships: TenantUser[];
}

export async function getSession(): Promise<SessionContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: rows } = await supabase
    .from('tenant_users')
    .select('*')
    .eq('user_id', data.user.id);

  const memberships = (rows ?? []) as TenantUser[];
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;
  const membership =
    memberships.find((m) => m.tenant_id === preferred) ?? memberships[0];

  return {
    userId: data.user.id,
    email: data.user.email ?? membership.email,
    tenantId: membership.tenant_id,
    role: membership.role,
    membership,
    memberships,
  };
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireOnboarded(): Promise<SessionContext> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const { data: rows } = await supabase
    .from('tenant_users')
    .select('*')
    .eq('user_id', data.user.id);

  if (!rows || rows.length === 0) redirect('/onboarding');
  return (await getSession())!;
}

export async function setActiveTenant(tenantId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}
