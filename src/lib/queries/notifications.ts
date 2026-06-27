import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AppNotification } from '@/lib/types/db';

export async function listMyNotifications(limit = 30): Promise<AppNotification[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .neq('type', 'new_message')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as AppNotification[];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = createSupabaseServerClient();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .neq('type', 'new_message')
    .eq('is_read', false);
  return count ?? 0;
}

export async function listMyMessages(limit = 30): Promise<AppNotification[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('type', 'new_message')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as AppNotification[];
}

export async function getUnreadMessageCount(): Promise<number> {
  const supabase = createSupabaseServerClient();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'new_message')
    .eq('is_read', false);
  return count ?? 0;
}
