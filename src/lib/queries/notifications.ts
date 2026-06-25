import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AppNotification } from '@/lib/types/db';

export async function listMyNotifications(limit = 30): Promise<AppNotification[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as AppNotification[];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = createSupabaseServerClient();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);
  return count ?? 0;
}
