// ============================================================================
// VEBOSSO EMS — Role Constants
// ============================================================================

import { UserRole } from '../types/database';

export const ROLES = {
  OWNER: 'owner' as UserRole,
  MANAGER: 'manager' as UserRole,
  MEMBER: 'member' as UserRole,
} as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  member: 'Member',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: 'Full access to all features and settings',
  manager: 'Can manage team members and approve check-ins',
  member: 'Can check in, view tasks, and submit reports',
};

// Status labels and colors for work logs
export const WORK_LOG_STATUS_CONFIG = {
  pending_approval: {
    label: 'Pending Approval',
    color: '#D97706',
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    icon: 'clock-outline',
  },
  working: {
    label: 'Working',
    color: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    icon: 'briefcase-outline',
  },
  pending_checkout: {
    label: 'Pending Checkout',
    color: '#4F46E5',
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    icon: 'clock-check-outline',
  },
  done: {
    label: 'Done',
    color: '#475569',
    backgroundColor: 'rgba(71, 85, 105, 0.08)',
    icon: 'check-circle-outline',
  },
  rejected: {
    label: 'Rejected',
    color: '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    icon: 'close-circle-outline',
  },
} as const;

export const TASK_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: '#D97706',
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    icon: 'circle-outline',
  },
  in_progress: {
    label: 'In Progress',
    color: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    icon: 'progress-clock',
  },
  done: {
    label: 'Done',
    color: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    icon: 'check-circle',
  },
} as const;

export const LEAVE_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: '#D97706',
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
  },
  approved: {
    label: 'Approved',
    color: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
  },
  rejected: {
    label: 'Rejected',
    color: '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
} as const;

// Employee ID prefix
export const EMPLOYEE_ID_PREFIX = 'VB';

// Minimum check-in plan length
export const MIN_CHECKIN_PLAN_LENGTH = 20;

// App name
export const APP_NAME = 'VEBOSSO';
export const APP_FULL_NAME = 'VEBOSSO EMS';
export const APP_TAGLINE = 'Employee Management System';
