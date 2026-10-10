// ============================================================================
// VEBOSSO EMS — Where a tapped notification goes
// Each push carries a `type` (and sometimes ids). This turns that, plus who is
// signed in, into the screen to open. The same notice means different things
// to different people: "check-in request" is the owner's inbox, but a manager's
// Approvals tab. A type nobody maps lands on the person's home screen.
//
// Two query params steer the destination screen:
//   inbox  owner dashboard: open the "Needs you now" list on this kind
//   open   profile / settings / chat: open this sheet
// `ts` just makes a repeat tap look new, so the screen reacts again.
// ============================================================================

import { UserRole as Role } from '../types/database';

export type NotificationTarget = { pathname: string; params?: Record<string, string> };

type Data = Record<string, unknown> | null | undefined;

const home = (role: Role): NotificationTarget =>
  role === 'owner'
    ? { pathname: '/(owner)/dashboard' }
    : role === 'manager'
      ? { pathname: '/(manager)/dashboard' }
      : { pathname: '/(member)/home' };

/** Owner: the dashboard's "Needs you now" list, on one kind. */
const inbox = (kind: string): NotificationTarget => ({ pathname: '/(owner)/dashboard', params: { inbox: kind } });

/** Manager / member: the sheet lives on their profile (member) or settings (manager). */
const sheet = (role: Role, open: 'details' | 'documents' | 'salary' | 'expenses'): NotificationTarget => ({
  pathname: role === 'manager' ? '/(manager)/settings' : '/(member)/profile',
  params: { open },
});

/** Chat with the boss: the Message buttons on the manager's dashboard / member's home. */
const chat = (role: Role): NotificationTarget => ({ ...home(role), params: { open: 'chat' } });

export function notificationTarget(role: Role | null | undefined, data: Data): NotificationTarget | null {
  if (!role) return null;
  const type = typeof data?.type === 'string' ? data.type : '';
  const owner = role === 'owner';
  const manager = role === 'manager';
  const group = `/(${role})`;

  switch (type) {
    // ---- Check-ins and check-outs -----------------------------------------
    case 'check_in_request':
      return owner ? inbox('checkin') : manager ? { pathname: '/(manager)/approvals' } : home(role);
    case 'checkout_request':
      return owner ? inbox('checkout') : manager ? { pathname: '/(manager)/approvals' } : home(role);
    case 'checkout_done':
      return owner || manager ? { pathname: `${group}/history` } : home(role);
    case 'check_in_approved':
    case 'check_out_approved':
    case 'check_in_rejected':
    case 'check_out_rejected':
    case 'backfill_granted':
      return home(role);
    case 'work_log_remark':
      return home(role);
    case 'work_log_remark_reply':
      return owner || manager ? { pathname: `${group}/history` } : home(role);

    // ---- Leave --------------------------------------------------------------
    case 'leave_request':
      return owner ? inbox('leave') : manager ? { pathname: '/(manager)/leaves' } : home(role);
    case 'leave_approved':
    case 'leave_rejected':
      return owner ? home(role) : { pathname: `${group}/leaves` };

    // ---- Tasks --------------------------------------------------------------
    case 'task_completed':
      return owner ? inbox('task') : { pathname: `${group}/tasks` };
    case 'task_assigned':
    case 'task_updated':
    case 'task_approved':
    case 'task_rejected':
    case 'task_reopened':
    case 'task_reassigned':
    case 'task_unassigned':
      return { pathname: `${group}/tasks` };

    // ---- Documents, salary, expenses, details ------------------------------
    case 'document_uploaded':
      return owner ? inbox('document') : sheet(role, 'documents');
    case 'document_approved':
    case 'document_rejected':
      return owner ? home(role) : sheet(role, 'documents');
    case 'salary_request':
    case 'salary_received':
      return owner ? inbox('salary') : sheet(role, 'salary');
    case 'salary_date':
    case 'salary_paid':
      return owner ? home(role) : sheet(role, 'salary');
    case 'expense_submitted':
    case 'expense_received':
      return owner ? inbox('expense') : sheet(role, 'expenses');
    case 'expense_date':
    case 'expense_paid':
      return owner ? home(role) : sheet(role, 'expenses');
    case 'employee_details':
    case 'employee_details_edit_request':
      return owner ? inbox('details') : sheet(role, 'details');
    case 'employee_details_edit_answer':
      return owner ? home(role) : sheet(role, 'details');

    // ---- Messages and announcements ------------------------------------------
    case 'chat_message':
      return owner ? inbox('message') : chat(role);
    case 'boss_message':
      return owner ? inbox('message') : home(role);
    case 'boss_message_done':
      return home(role);
    case 'announcement':
      return owner ? { pathname: '/(owner)/settings/announcements' } : role === 'member' ? { pathname: '/(member)/announcements' } : home(role);

    // ---- Everything else ------------------------------------------------------
    case 'venue_added':
      return { pathname: `${group}/venues` };
    case 'manager_assigned':
    case 'feature_access':
      return home(role);
    default:
      return home(role);
  }
}

/** The target as a router href, with a fresh `ts` so the same screen reacts again. */
export function notificationHref(role: Role | null | undefined, data: Data) {
  const t = notificationTarget(role, data);
  if (!t) return null;
  return { pathname: t.pathname, params: { ...t.params, ts: String(Date.now()) } };
}
