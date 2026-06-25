'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import type { OrganizationType, UserRole } from '@/lib/types/db';

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  phone: z.string().optional(),
});

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function signInAction(formData: FormData): Promise<ActionResult> {
  const parsed = SignInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: error.message };
  redirect('/dashboard');
}

export async function signUpAction(formData: FormData): Promise<ActionResult> {
  const parsed = SignUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, phone: parsed.data.phone },
    },
  });
  if (error) return { ok: false, error: error.message };

  // Create a barebones profile row so RLS helpers have something to read.
  if (data.user) {
    const admin = createSupabaseServiceClient();
    await admin.from('users').upsert(
      {
        id: data.user.id,
        full_name: parsed.data.fullName,
        phone: parsed.data.phone ?? null,
      },
      { onConflict: 'id' }
    );
  }
  redirect('/onboarding');
}

const CreateOrgSchema = z.object({
  type: z.enum(['clinic', 'lab']),
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  currency: z.string().default('USD'),
});

export async function createOrgAction(formData: FormData): Promise<ActionResult> {
  const supabase = createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, error: 'Not authenticated' };

  const parsed = CreateOrgSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const admin = createSupabaseServiceClient();
  const role: UserRole = parsed.data.type === 'clinic' ? 'clinic_admin' : 'lab_admin';

  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .insert({
      type: parsed.data.type as OrganizationType,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      currency: parsed.data.currency || 'USD',
    })
    .select()
    .single();
  if (orgErr || !org) return { ok: false, error: orgErr?.message ?? 'Failed to create org' };

  const { error: profileErr } = await admin
    .from('users')
    .update({ organization_id: org.id, role })
    .eq('id', user.id);
  if (profileErr) return { ok: false, error: profileErr.message };

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signOutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function setLocaleAction(locale: 'ar' | 'en') {
  const { cookies } = await import('next/headers');
  cookies().set('NEXT_LOCALE', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/', 'layout');
}

export async function toggleLocaleAction() {
  const { cookies } = await import('next/headers');
  const current = cookies().get('NEXT_LOCALE')?.value ?? 'ar';
  const next = current === 'ar' ? 'en' : 'ar';
  cookies().set('NEXT_LOCALE', next, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/', 'layout');
}
