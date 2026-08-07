// ============================================================================
// VEBOSSO EMS — Role Constants
// ============================================================================

import { UserRole } from '../types/database';
import { AppTheme } from './theme';

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

// Status labels and colours for work logs.
// Colours come from AppTheme so status chips stay in step with the design
// system; the `*Soft` tints are deliberately strong enough to read as coloured.
export const WORK_LOG_STATUS_CONFIG = {
  pending_approval: {
    label: 'Pending Approval',
    color: AppTheme.amber,
    backgroundColor: AppTheme.amberSoft,
    icon: 'clock-outline',
  },
  working: {
    label: 'Working',
    color: AppTheme.green,
    backgroundColor: AppTheme.greenSoft,
    icon: 'briefcase-outline',
  },
  pending_checkout: {
    label: 'Pending Checkout',
    color: AppTheme.violet,
    backgroundColor: AppTheme.violetSoft,
    icon: 'clock-check-outline',
  },
  done: {
    label: 'Done',
    color: AppTheme.inkSoft,
    backgroundColor: AppTheme.soft,
    icon: 'check-circle-outline',
  },
  rejected: {
    label: 'Rejected',
    color: AppTheme.coral,
    backgroundColor: AppTheme.coralSoft,
    icon: 'close-circle-outline',
  },
} as const;

export const TASK_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: AppTheme.amber,
    backgroundColor: AppTheme.amberSoft,
    icon: 'circle-outline',
  },
  in_progress: {
    label: 'In Progress',
    color: AppTheme.blue,
    backgroundColor: AppTheme.blueSoft,
    icon: 'progress-clock',
  },
  done: {
    label: 'Done',
    color: AppTheme.green,
    backgroundColor: AppTheme.greenSoft,
    icon: 'check-circle',
  },
} as const;

export const LEAVE_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: AppTheme.amber,
    backgroundColor: AppTheme.amberSoft,
  },
  approved: {
    label: 'Approved',
    color: AppTheme.green,
    backgroundColor: AppTheme.greenSoft,
  },
  rejected: {
    label: 'Rejected',
    color: AppTheme.coral,
    backgroundColor: AppTheme.coralSoft,
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
