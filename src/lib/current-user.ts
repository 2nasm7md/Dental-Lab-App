import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase/server';
import type { AppUser, Organization } from './types/db';

export interface CurrentSession {
  authUserId: string;
  email: string;
  profile: AppUser | null;
  organization: Organization | null;
}

export interface BoundSession {
  authUserId: string;
  email: string;
  profile: AppUser & { role: NonNullable<AppUser['role']>; organization_id: string };
  organization: Organization;
}

/**
 * Use this from any (app) page to guarantee a fully-bound session
 * (auth + profile + org + role). Throws redirects for unauth / un-onboarded.
 * The (app) layout still redirects, but the page also needs to short-circuit
 * because Next.js evaluates layout and page in parallel.
 */
export async function requireSession(): Promise<BoundSession> {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!session.profile?.organization_id || !session.profile.role || !session.organization) {
    redirect('/onboarding');
  }
  return {
    authUserId: session.authUserId,
    email: session.email,
    profile: session.profile as BoundSession['profile'],
    organization: session.organization,
  };
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const supabase = createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const authUser = userData.user;
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  let organization: Organization | null = null;
  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', profile.organization_id)
      .maybeSingle();
    organization = (org as Organization) ?? null;
  }

  return {
    authUserId: authUser.id,
    email: authUser.email ?? '',
    profile: (profile as AppUser) ?? null,
    organization,
  };
}
