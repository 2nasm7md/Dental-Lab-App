import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Connection, Organization, AppUser } from '@/lib/types/db';

function logSb(scope: string, error: unknown) {
  const e = error as { message?: string; code?: string; details?: string; hint?: string };
  console.error(`[queries:${scope}] supabase error`, {
    message: e?.message,
    code: e?.code,
    details: e?.details,
    hint: e?.hint,
  });
}

export interface ConnectedPartner {
  connection_id: string;
  org: Pick<Organization, 'id' | 'name' | 'type' | 'phone' | 'email' | 'logo_url'>;
}

// connections has two FKs to organizations (clinic_org_id and lab_org_id), which
// makes PostgREST embedded joins ambiguous in some versions and can return the
// partner as null or as an array. We sidestep all of that by fetching
// connections and organizations separately and joining in code.

type OrgLite = Pick<Organization, 'id' | 'name' | 'type' | 'phone' | 'email' | 'logo_url'>;

async function fetchOrgsByIds(ids: string[]): Promise<Map<string, OrgLite>> {
  const supabase = createSupabaseServerClient();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, type, phone, email, logo_url')
    .in('id', unique);
  if (error) {
    logSb('fetchOrgsByIds', error);
    throw new Error(`fetchOrgsByIds: ${error.message ?? 'unknown'}`);
  }
  const map = new Map<string, OrgLite>();
  for (const o of (data ?? []) as OrgLite[]) map.set(o.id, o);
  return map;
}

export async function listActivePartners(
  orgId: string,
  orgType: 'clinic' | 'lab'
): Promise<ConnectedPartner[]> {
  const supabase = createSupabaseServerClient();
  const column = orgType === 'clinic' ? 'clinic_org_id' : 'lab_org_id';
  const otherColumn = orgType === 'clinic' ? 'lab_org_id' : 'clinic_org_id';

  const { data, error } = await supabase
    .from('connections')
    .select('id, clinic_org_id, lab_org_id')
    .eq(column, orgId)
    .eq('status', 'active');
  if (error) {
    logSb('listActivePartners.connections', error);
    throw new Error(`listActivePartners.connections: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    clinic_org_id: string;
    lab_org_id: string;
  }>;
  const orgs = await fetchOrgsByIds(
    rows.map((r) => (otherColumn === 'lab_org_id' ? r.lab_org_id : r.clinic_org_id))
  );

  return rows
    .map((r) => {
      const partnerId = otherColumn === 'lab_org_id' ? r.lab_org_id : r.clinic_org_id;
      const org = orgs.get(partnerId);
      if (!org) return null;
      return { connection_id: r.id, org };
    })
    .filter((x): x is ConnectedPartner => x !== null);
}

export async function listOutgoingPending(
  orgId: string,
  orgType: 'clinic' | 'lab'
): Promise<string[]> {
  const supabase = createSupabaseServerClient();
  const column = orgType === 'clinic' ? 'clinic_org_id' : 'lab_org_id';
  const otherColumn = orgType === 'clinic' ? 'lab_org_id' : 'clinic_org_id';
  const { data, error } = await supabase
    .from('connections')
    .select('clinic_org_id, lab_org_id')
    .eq(column, orgId)
    .eq('status', 'pending');
  if (error) {
    logSb('listOutgoingPending', error);
    throw new Error(`listOutgoingPending: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{ clinic_org_id: string; lab_org_id: string }>;
  return rows.map((r) =>
    otherColumn === 'lab_org_id' ? r.lab_org_id : r.clinic_org_id
  );
}

export interface PendingConnectionRow {
  id: string;
  status: string;
  created_at: string;
  partner: OrgLite;
}

export async function listPendingConnections(
  orgId: string,
  orgType: 'clinic' | 'lab'
): Promise<PendingConnectionRow[]> {
  const supabase = createSupabaseServerClient();
  const column = orgType === 'lab' ? 'lab_org_id' : 'clinic_org_id';
  const otherColumn = orgType === 'lab' ? 'clinic_org_id' : 'lab_org_id';
  const { data, error } = await supabase
    .from('connections')
    .select('id, status, created_at, clinic_org_id, lab_org_id')
    .eq(column, orgId)
    .eq('status', 'pending');
  if (error) {
    logSb('listPendingConnections', error);
    throw new Error(`listPendingConnections: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{
    id: string;
    status: string;
    created_at: string;
    clinic_org_id: string;
    lab_org_id: string;
  }>;
  const orgs = await fetchOrgsByIds(
    rows.map((r) => (otherColumn === 'lab_org_id' ? r.lab_org_id : r.clinic_org_id))
  );
  return rows
    .map((r) => {
      const partnerId = otherColumn === 'lab_org_id' ? r.lab_org_id : r.clinic_org_id;
      const partner = orgs.get(partnerId);
      if (!partner) return null;
      return { id: r.id, status: r.status, created_at: r.created_at, partner };
    })
    .filter((x): x is PendingConnectionRow => x !== null);
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

// Returns everyone in the clinic who is allowed to OWN a case:
// active doctors and active clinic_admins. Used by the new-case form so a
// solo-clinic admin can pick themselves.
export async function listClinicCaseOwners(clinicOrgId: string): Promise<AppUser[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('organization_id', clinicOrgId)
    .in('role', ['doctor', 'clinic_admin'])
    .eq('is_active', true)
    .order('role')
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
