import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { CaseStatus, DentalCase, Organization, AppUser } from '@/lib/types/db';

export interface CaseRow extends DentalCase {
  lab: Pick<Organization, 'id' | 'name'> | null;
  clinic: Pick<Organization, 'id' | 'name'> | null;
  owner_doctor: Pick<AppUser, 'id' | 'full_name'> | null;
  technician: Pick<AppUser, 'id' | 'full_name'> | null;
}

export interface CaseFilters {
  status?: CaseStatus | 'all' | 'active' | 'closed' | 'attention';
  labOrgId?: string;
  clinicOrgId?: string;
  doctorId?: string;
  technicianId?: string;
  q?: string;
}

const ACTIVE_STATUSES: CaseStatus[] = [
  'pending',
  'accepted',
  'in_production',
  'ready',
  'redo',
];
const CLOSED_STATUSES: CaseStatus[] = ['delivered', 'cancelled'];
const ATTENTION_STATUSES: CaseStatus[] = ['declined', 'redo'];

// cases has two FKs to organizations (clinic_org_id, lab_org_id) and two to
// users (owner_doctor_id, assigned_technician_id, created_by). PostgREST embed
// disambiguation across two FKs is fragile across versions, so we hydrate
// related rows with separate queries and merge.
async function hydrateRelations(rows: DentalCase[]): Promise<CaseRow[]> {
  if (rows.length === 0) return [];
  const supabase = createSupabaseServerClient();

  const orgIds = new Set<string>();
  const userIds = new Set<string>();
  for (const r of rows) {
    if (r.clinic_org_id) orgIds.add(r.clinic_org_id);
    if (r.lab_org_id) orgIds.add(r.lab_org_id);
    if (r.owner_doctor_id) userIds.add(r.owner_doctor_id);
    if (r.assigned_technician_id) userIds.add(r.assigned_technician_id);
  }

  const [{ data: orgData }, { data: userData }] = await Promise.all([
    orgIds.size > 0
      ? supabase
          .from('organizations')
          .select('id, name')
          .in('id', Array.from(orgIds))
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    userIds.size > 0
      ? supabase
          .from('users')
          .select('id, full_name')
          .in('id', Array.from(userIds))
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ]);

  const orgs = new Map((orgData ?? []).map((o) => [o.id, o]));
  const users = new Map((userData ?? []).map((u) => [u.id, u]));

  return rows.map((r) => ({
    ...r,
    lab: r.lab_org_id ? orgs.get(r.lab_org_id) ?? null : null,
    clinic: r.clinic_org_id ? orgs.get(r.clinic_org_id) ?? null : null,
    owner_doctor: r.owner_doctor_id ? users.get(r.owner_doctor_id) ?? null : null,
    technician: r.assigned_technician_id
      ? users.get(r.assigned_technician_id) ?? null
      : null,
  }));
}

function escapeOrFilter(input: string): string {
  // PostgREST .or() treats parens, commas, and the percent literal as syntax.
  return input.replace(/[%(),:]/g, '');
}

export async function listCases(filters: CaseFilters = {}): Promise<CaseRow[]> {
  const supabase = createSupabaseServerClient();
  let q = supabase
    .from('cases')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'active') q = q.in('status', ACTIVE_STATUSES);
    else if (filters.status === 'closed') q = q.in('status', CLOSED_STATUSES);
    else if (filters.status === 'attention') q = q.in('status', ATTENTION_STATUSES);
    else q = q.eq('status', filters.status);
  }
  if (filters.labOrgId) q = q.eq('lab_org_id', filters.labOrgId);
  if (filters.clinicOrgId) q = q.eq('clinic_org_id', filters.clinicOrgId);
  if (filters.doctorId) q = q.eq('owner_doctor_id', filters.doctorId);
  if (filters.technicianId) q = q.eq('assigned_technician_id', filters.technicianId);
  if (filters.q) {
    const safe = escapeOrFilter(filters.q);
    if (safe) {
      q = q.or(
        `case_number.ilike.%${safe}%,patient_name.ilike.%${safe}%,patient_ref.ilike.%${safe}%`
      );
    }
  }

  const { data, error } = await q;
  if (error) {
    console.error('listCases failed:', error);
    return [];
  }
  return hydrateRelations((data ?? []) as DentalCase[]);
}

export async function getCaseById(id: string): Promise<CaseRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    console.error('getCaseById failed:', error);
    return null;
  }
  if (!data) return null;
  const [hydrated] = await hydrateRelations([data as DentalCase]);
  return hydrated ?? null;
}

export interface DashboardCounts {
  total: number;
  pending: number;
  inProduction: number;
  ready: number;
  attention: number;
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('cases')
    .select('status')
    .is('deleted_at', null);
  if (error) {
    console.error('getDashboardCounts failed:', error);
    return { total: 0, pending: 0, inProduction: 0, ready: 0, attention: 0 };
  }
  const rows = (data ?? []) as { status: CaseStatus }[];
  return {
    total: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    inProduction: rows.filter((r) => r.status === 'in_production').length,
    ready: rows.filter((r) => r.status === 'ready').length,
    attention: rows.filter((r) => ATTENTION_STATUSES.includes(r.status)).length,
  };
}
