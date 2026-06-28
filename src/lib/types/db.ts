// Hand-typed database row shapes. Mirrors supabase/migrations/001_init.sql.

export type Role = 'owner' | 'admin' | 'receptionist';

export type AppointmentStatus =
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';
export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise';

export type Locale = 'ar' | 'en';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  public: boolean;
  created_at: string;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: Role;
  full_name: string | null;
  email: string;
  created_at: string;
}

export interface Doctor {
  id: string;
  tenant_id: string;
  name: string;
  specialty: string | null;
  photo_url: string | null;
  bio: string | null;
  active: boolean;
  created_at: string;
}

export interface VisitType {
  id: string;
  tenant_id: string;
  name: string;
  duration_minutes: number;
  active: boolean;
  created_at: string;
}

export interface ScheduleDay {
  id: string;
  tenant_id: string;
  doctor_id: string;
  weekday: number; // 0=Sunday … 6=Saturday
  start_minutes: number;
  end_minutes: number;
}

export interface ScheduleBreak {
  id: string;
  tenant_id: string;
  doctor_id: string;
  weekday: number;
  start_minutes: number;
  end_minutes: number;
}

export interface ScheduleAbsence {
  id: string;
  tenant_id: string;
  doctor_id: string;
  kind: 'vacation' | 'unavailable';
  start_at: string; // timestamptz
  end_at: string;
  reason: string | null;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  doctor_id: string;
  visit_type_id: string;
  patient_name: string;
  patient_phone: string;
  patient_age: number | null;
  patient_gender: 'male' | 'female' | null;
  patient_email: string | null;
  notes: string | null;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  created_at: string;
}

export interface PortfolioCase {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  category: string | null;
  before_image_url: string;
  after_image_url: string;
  created_at: string;
}

export interface ClinicSettings {
  tenant_id: string;
  display_name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  about: string | null;
  default_locale: Locale;
  rtl_enabled: boolean;
  updated_at: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  start_date: string;
  end_date: string | null;
}
