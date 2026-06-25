import { createSupabaseServerClient } from './supabase/server';
import type { AppUser, Organization } from './types/db';

export interface CurrentSession {
  authUserId: string;
  email: string;
  profile: AppUser | null;
  organization: Organization | null;
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
