'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { setActiveTenant } from '@/lib/auth/session';
import {
  loginSchema,
  signupSchema,
  onboardingSchema,
} from '@/lib/validation/auth';

export interface ActionResult {
  error?: string;
}

export async function loginAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: 'invalid_credentials' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: 'invalid_credentials' };

  const { data: rows } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .limit(1);

  if (!rows || rows.length === 0) redirect('/onboarding');
  redirect('/dashboard');
}

export async function signupAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: 'invalid_input' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name } },
  });
  if (error || !data.user) return { error: 'signup_failed' };

  redirect('/onboarding');
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function provisionTenantAction(
  _: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: 'invalid_input' };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'unauthenticated' };

  const fullName =
    (userData.user.user_metadata?.full_name as string | undefined) ?? userData.user.email!;

  const { data, error } = await supabase.rpc('provision_tenant', {
    p_name: parsed.data.clinic_name,
    p_slug: parsed.data.slug,
    p_full_name: fullName,
    p_email: userData.user.email!,
  });

  if (error || !data || data.length === 0) return { error: 'provision_failed' };
  await setActiveTenant(data[0].tenant_id);
  redirect('/dashboard');
}
