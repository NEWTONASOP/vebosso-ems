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
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    icon: 'clock-outline',
  },
  working: {
    label: 'Working',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    icon: 'briefcase-outline',
  },
  pending_checkout: {
    label: 'Pending Checkout',
    color: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    icon: 'clock-check-outline',
  },
  done: {
    label: 'Done',
    color: '#9CA3AF',
    backgroundColor: 'rgba(156, 163, 175, 0.12)',
    icon: 'check-circle-outline',
  },
  rejected: {
    label: 'Rejected',
    color: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    icon: 'close-circle-outline',
  },
} as const;

export const TASK_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    icon: 'circle-outline',
  },
  in_progress: {
    label: 'In Progress',
    color: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    icon: 'progress-clock',
  },
  done: {
    label: 'Done',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    icon: 'check-circle',
  },
} as const;

export const LEAVE_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  approved: {
    label: 'Approved',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  rejected: {
    label: 'Rejected',
    color: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
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
