import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Connection, Organization, AppUser } from '@/lib/types/db';

export interface ConnectedPartner {
  connection_id: string;
  org: Pick<Organization, 'id' | 'name' | 'type' | 'phone' | 'email' | 'logo_url'>;
}

export async function listActivePartners(
  orgId: string,
  orgType: 'clinic' | 'lab'
): Promise<ConnectedPartner[]> {
  const supabase = createSupabaseServerClient();
  const column = orgType === 'clinic' ? 'clinic_org_id' : 'lab_org_id';
  const otherColumn = orgType === 'clinic' ? 'lab_org_id' : 'clinic_org_id';

  const { data } = await supabase
    .from('connections')
    .select(`id, ${otherColumn}, partner:${otherColumn} ( id, name, type, phone, email, logo_url )`)
    .eq(column, orgId)
    .eq('status', 'active');

  return ((data ?? []) as unknown as Array<{ id: string; partner: ConnectedPartner['org'] }>).map((r) => ({
    connection_id: r.id,
    org: r.partner,
  }));
}

export async function listOutgoingPending(orgId: string, orgType: 'clinic' | 'lab') {
  const supabase = createSupabaseServerClient();
  const column = orgType === 'clinic' ? 'clinic_org_id' : 'lab_org_id';
  const otherColumn = orgType === 'clinic' ? 'lab_org_id' : 'clinic_org_id';
  const { data } = await supabase
    .from('connections')
    .select(`id, ${otherColumn}`)
    .eq(column, orgId)
    .eq('status', 'pending');
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return rows.map((r) => r[otherColumn] as string);
}

export async function listPendingConnections(orgId: string, orgType: 'clinic' | 'lab') {
  const supabase = createSupabaseServerClient();
  const column = orgType === 'lab' ? 'lab_org_id' : 'clinic_org_id';
  const otherColumn = orgType === 'lab' ? 'clinic_org_id' : 'lab_org_id';
  const { data } = await supabase
    .from('connections')
    .select(
      `id, status, created_at, partner:${otherColumn} ( id, name, type, phone, email, logo_url )`
    )
    .eq(column, orgId)
    .eq('status', 'pending');
  return (data ?? []) as unknown as Array<{
    id: string;
    status: string;
    created_at: string;
    partner: ConnectedPartner['org'];
  }>;
}

export async function listClinicDoctors(clinicOrgId: string): Promise<AppUser[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('organization_id', clinicOrgId)
    .eq('role', 'doctor')
    .eq('is_active', true)
    .order('full_name');
  return (data ?? []) as AppUser[];
}

export async function listLabTechnicians(labOrgId: string): Promise<AppUser[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('organization_id', labOrgId)
    .eq('role', 'technician')
    .eq('is_active', true)
    .order('full_name');
  return (data ?? []) as AppUser[];
}
