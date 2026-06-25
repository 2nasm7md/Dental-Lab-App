'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function markNotificationReadAction(id: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/notifications');
  return { ok: true as const };
}

export async function markAllNotificationsReadAction() {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/notifications');
  return { ok: true as const };
}
