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

export async function listCases(filters: CaseFilters = {}): Promise<CaseRow[]> {
  const supabase = createSupabaseServerClient();
  let q = supabase
    .from('cases')
    .select(
      `
      *,
      lab:lab_org_id ( id, name ),
      clinic:clinic_org_id ( id, name ),
      owner_doctor:owner_doctor_id ( id, full_name ),
      technician:assigned_technician_id ( id, full_name )
    `
    )
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
    q = q.or(
      `case_number.ilike.%${filters.q}%,patient_name.ilike.%${filters.q}%,patient_ref.ilike.%${filters.q}%`
    );
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as CaseRow[];
}

export async function getCaseById(id: string): Promise<CaseRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('cases')
    .select(
      `
      *,
      lab:lab_org_id ( id, name ),
      clinic:clinic_org_id ( id, name ),
      owner_doctor:owner_doctor_id ( id, full_name ),
      technician:assigned_technician_id ( id, full_name )
    `
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CaseRow) ?? null;
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
    .select('status', { count: 'exact', head: false })
    .is('deleted_at', null);
  if (error) throw error;
  const rows = (data ?? []) as { status: CaseStatus }[];
  return {
    total: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    inProduction: rows.filter((r) => r.status === 'in_production').length,
    ready: rows.filter((r) => r.status === 'ready').length,
    attention: rows.filter((r) => ATTENTION_STATUSES.includes(r.status)).length,
  };
}
