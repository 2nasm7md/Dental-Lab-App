import type { Role } from '@/lib/types/db';

export type Permission =
  | 'tenant.manage'
  | 'tenant.delete'
  | 'doctors.manage'
  | 'doctors.view'
  | 'visit_types.manage'
  | 'visit_types.view'
  | 'schedules.manage'
  | 'schedules.view'
  | 'appointments.manage'
  | 'appointments.view'
  | 'portfolio.manage'
  | 'portfolio.view'
  | 'settings.manage'
  | 'settings.view'
  | 'users.manage';

const MATRIX: Record<Role, Permission[]> = {
  owner: [
    'tenant.manage',
    'tenant.delete',
    'doctors.manage',
    'doctors.view',
    'visit_types.manage',
    'visit_types.view',
    'schedules.manage',
    'schedules.view',
    'appointments.manage',
    'appointments.view',
    'portfolio.manage',
    'portfolio.view',
    'settings.manage',
    'settings.view',
    'users.manage',
  ],
  admin: [
    'doctors.manage',
    'doctors.view',
    'visit_types.manage',
    'visit_types.view',
    'schedules.manage',
    'schedules.view',
    'appointments.manage',
    'appointments.view',
    'portfolio.manage',
    'portfolio.view',
    'settings.view',
  ],
  receptionist: [
    'doctors.view',
    'visit_types.view',
    'schedules.view',
    'appointments.manage',
    'appointments.view',
    'portfolio.view',
  ],
};

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role].includes(permission);
}

export function assertPermission(role: Role | null | undefined, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error(`forbidden: missing permission ${permission}`);
  }
}
