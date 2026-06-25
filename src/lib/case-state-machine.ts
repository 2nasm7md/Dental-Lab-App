// ============================================================================
// Case state machine — single source of truth for the lifecycle.
// Database functions (003_state_machine.sql) enforce the same rules. This
// module is used by the UI to disable/enable actions; the server still validates.
// ============================================================================

import type { CaseStatus, UserRole, OrganizationType } from './types/db';

export const CASE_STATUSES: CaseStatus[] = [
  'draft',
  'pending',
  'declined',
  'accepted',
  'in_production',
  'ready',
  'delivered',
  'redo',
  'cancelled',
];

export type Side = 'clinic' | 'lab';

export interface TransitionContext {
  side: Side;
  role: UserRole;
  isAssignedTech?: boolean;
}

export interface Transition {
  from: CaseStatus;
  to: CaseStatus;
  side: Side;
  allowedRoles: UserRole[];
  /** Action label key for the UI. */
  labelKey: string;
}

export const TRANSITIONS: Transition[] = [
  {
    from: 'draft',
    to: 'pending',
    side: 'clinic',
    allowedRoles: ['clinic_admin', 'doctor', 'secretary'],
    labelKey: 'actions.send',
  },
  {
    from: 'pending',
    to: 'accepted',
    side: 'lab',
    allowedRoles: ['lab_admin'],
    labelKey: 'actions.accept',
  },
  {
    from: 'pending',
    to: 'declined',
    side: 'lab',
    allowedRoles: ['lab_admin'],
    labelKey: 'actions.decline',
  },
  {
    from: 'declined',
    to: 'pending',
    side: 'clinic',
    allowedRoles: ['clinic_admin', 'doctor', 'secretary'],
    labelKey: 'actions.reassign',
  },
  {
    from: 'accepted',
    to: 'in_production',
    side: 'lab',
    allowedRoles: ['lab_admin', 'technician'],
    labelKey: 'actions.startProduction',
  },
  {
    from: 'in_production',
    to: 'ready',
    side: 'lab',
    allowedRoles: ['lab_admin', 'technician'],
    labelKey: 'actions.markReady',
  },
  {
    from: 'ready',
    to: 'delivered',
    side: 'lab',
    allowedRoles: ['lab_admin', 'technician'],
    labelKey: 'actions.markDelivered',
  },
  {
    from: 'delivered',
    to: 'redo',
    side: 'clinic',
    allowedRoles: ['clinic_admin', 'doctor', 'secretary'],
    labelKey: 'actions.requestRedo',
  },
  {
    from: 'redo',
    to: 'in_production',
    side: 'lab',
    allowedRoles: ['lab_admin', 'technician'],
    labelKey: 'actions.resumeProduction',
  },
];

export const CANCELLABLE_FROM: CaseStatus[] = ['draft', 'pending', 'declined'];

export function availableTransitions(
  current: CaseStatus,
  ctx: TransitionContext
): Transition[] {
  return TRANSITIONS.filter((t) => {
    if (t.from !== current) return false;
    if (t.side !== ctx.side) return false;
    if (!t.allowedRoles.includes(ctx.role)) return false;
    if (ctx.role === 'technician' && !ctx.isAssignedTech) return false;
    return true;
  });
}

export function canCancel(current: CaseStatus, ctx: TransitionContext): boolean {
  return (
    ctx.side === 'clinic' &&
    CANCELLABLE_FROM.includes(current) &&
    ['clinic_admin', 'doctor', 'secretary'].includes(ctx.role)
  );
}

export function sideOfRole(role: UserRole): Side {
  switch (role) {
    case 'clinic_admin':
    case 'doctor':
    case 'secretary':
      return 'clinic';
    case 'lab_admin':
    case 'technician':
      return 'lab';
  }
}

export function sideOfOrgType(type: OrganizationType): Side {
  return type === 'clinic' ? 'clinic' : 'lab';
}

export const STATUS_GROUPS = {
  active: [
    'pending',
    'accepted',
    'in_production',
    'ready',
    'redo',
  ] as CaseStatus[],
  closed: ['delivered', 'cancelled'] as CaseStatus[],
  inbox: ['pending'] as CaseStatus[],
  attention: ['declined', 'redo'] as CaseStatus[],
};

export function isOverdue(due: string | null, status: CaseStatus): boolean {
  if (!due) return false;
  if (STATUS_GROUPS.closed.includes(status)) return false;
  return new Date(due).getTime() < Date.now();
}
