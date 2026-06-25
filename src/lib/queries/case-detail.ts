import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  CaseStatusHistoryEntry,
  CaseAttachment,
  CaseMessage,
} from '@/lib/types/db';

export async function getCaseHistory(caseId: string): Promise<CaseStatusHistoryEntry[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('case_status_history')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true });
  return (data ?? []) as CaseStatusHistoryEntry[];
}

export async function getCaseAttachments(caseId: string): Promise<CaseAttachment[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('case_attachments')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });
  return (data ?? []) as CaseAttachment[];
}

export async function getCaseMessages(caseId: string): Promise<CaseMessage[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('case_messages')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
    .limit(200);
  return (data ?? []) as CaseMessage[];
}
