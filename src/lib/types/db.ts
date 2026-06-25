// ============================================================================
// Database types — kept in sync with supabase/migrations/001_initial_schema.sql
// In a mature project these would be generated via `supabase gen types`;
// for v1 we hand-maintain them so the spec is readable in one place.
// ============================================================================

export type OrganizationType = 'clinic' | 'lab';

export type UserRole =
  | 'clinic_admin'
  | 'doctor'
  | 'secretary'
  | 'lab_admin'
  | 'technician';

export type ConnectionStatus = 'pending' | 'active' | 'blocked';

export type InvitationStatus = 'sent' | 'accepted' | 'expired' | 'revoked';

export type CaseStatus =
  | 'draft'
  | 'pending'
  | 'declined'
  | 'accepted'
  | 'in_production'
  | 'ready'
  | 'delivered'
  | 'redo'
  | 'cancelled';

export type RestorationType =
  | 'crown'
  | 'bridge'
  | 'veneer'
  | 'inlay_onlay'
  | 'denture_full'
  | 'denture_partial'
  | 'implant_crown'
  | 'implant_bridge'
  | 'night_guard'
  | 'other';

export type MaterialType =
  | 'zirconia'
  | 'emax'
  | 'pfm'
  | 'full_metal'
  | 'pmma'
  | 'acrylic'
  | 'other';

export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export type AttachmentType = 'image' | 'file';

export type NotificationType =
  | 'case_assigned'
  | 'case_accepted'
  | 'case_declined'
  | 'status_changed'
  | 'new_message'
  | 'connection_request'
  | 'connection_accepted'
  | 'payment_updated';

export interface OrgSettings {
  all_doctors_see_all_cases: boolean;
  cost_tracking_enabled: boolean;
  pending_timeout_hours: number;
  techs_see_unassigned: boolean;
  [key: string]: unknown;
}

export interface Organization {
  id: string;
  type: OrganizationType;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  currency: string;
  settings: OrgSettings;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AppUser {
  id: string;
  organization_id: string | null;
  role: UserRole | null;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  assists_doctor_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  clinic_org_id: string;
  lab_org_id: string;
  status: ConnectionStatus;
  requested_by: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  from_org_id: string;
  invited_email: string | null;
  invited_phone: string | null;
  invited_org_type: OrganizationType;
  token: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_org_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DentalCase {
  id: string;
  case_number: string;
  clinic_org_id: string;
  lab_org_id: string | null;
  owner_doctor_id: string;
  created_by: string;
  assigned_technician_id: string | null;
  status: CaseStatus;

  patient_name: string | null;
  patient_ref: string | null;
  tooth_numbers: string[];
  restoration_type: RestorationType | null;
  material: MaterialType | null;
  shade: string | null;
  due_date: string | null;
  doctor_notes: string | null;

  price: number | null;
  currency: string | null;
  payment_status: PaymentStatus | null;

  decline_reason: string | null;
  metadata: Record<string, unknown>;

  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CaseAttachment {
  id: string;
  case_id: string;
  uploaded_by: string;
  file_url: string;
  file_type: AttachmentType;
  thumbnail_url: string | null;
  caption: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface CaseStatusHistoryEntry {
  id: string;
  case_id: string;
  from_status: CaseStatus | null;
  to_status: CaseStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface CaseMessage {
  id: string;
  case_id: string;
  sender_id: string;
  body: string;
  attachment_url: string | null;
  attachment_type: AttachmentType | null;
  read_by: string[];
  created_at: string;
}

export interface AppNotification {
  id: string;
  recipient_user_id: string;
  type: NotificationType;
  case_id: string | null;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}
