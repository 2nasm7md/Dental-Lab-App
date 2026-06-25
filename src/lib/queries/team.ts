import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AppUser } from '@/lib/types/db';

export async function listOrgMembers(orgId: string): Promise<AppUser[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('organization_id', orgId)
    .order('is_active', { ascending: false })
    .order('role')
    .order('full_name');
  return (data ?? []) as AppUser[];
}
