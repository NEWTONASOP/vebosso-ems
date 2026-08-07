// ============================================================================
// VEBOSSO EMS — Attendance day timeline
//
// Turns a day's raw records (work log, tasks, leave) into an ordered list of
// timeline events. Pure: no store or network access, so it can be unit tested
// and reused by every role's history screen.
// ============================================================================

import { AppTheme } from '../constants/theme';
import { LeaveRequest, Task, WorkLog } from '../types/database';

export type TimelineEventKind = 'check-in' | 'task' | 'check-out' | 'leave';

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  /** ISO timestamp. Null for all-day entries such as leave. */
  at: string | null;
  title: string;
  subtitle: string | null;
  /** Accent rail colour for the event card. */
  color: string;
  soft: string;
  /** Shown on the right of the card, e.g. total hours. */
  trailing?: string | null;
}

/** Why a day has no timeline, so the UI can explain rather than show nothing. */
export type EmptyDayReason = 'future' | 'no-record';

export interface DayTimeline {
  events: TimelineEvent[];
  /** Present only when `events` is empty. */
  emptyReason: EmptyDayReason | null;
  /** Session length in hours, when the day is complete. */
  totalHours: number | null;
}

function checkInAccent(workLog: WorkLog): { color: string; soft: string } {
  if (workLog.status === 'rejected') {
    return { color: AppTheme.coral, soft: AppTheme.coralSoft };
  }
  if (!workLog.check_in_approved) {
    return { color: AppTheme.amber, soft: AppTheme.amberSoft };
  }
  return { color: AppTheme.green, soft: AppTheme.greenSoft };
}

function checkInLabel(workLog: WorkLog): string {
  if (workLog.status === 'rejected') return 'Check-in rejected';
  if (!workLog.check_in_approved) return 'Check-in awaiting approval';
  return 'Checked in';
}

/**
 * Tasks carry only `completed_at`, never a start time, so a task can only be
 * placed on the timeline once it has actually been completed.
 */
function isCompletedOnDay(task: Task, day: string): boolean {
  if (task.status !== 'done' || !task.completed_at) return false;
  return task.completed_at.slice(0, 10) === day;
}

export function buildDayTimeline({
  day,
  workLog,
  tasks,
  leave,
  now = new Date(),
}: {
  /** yyyy-MM-dd */
  day: string;
  workLog: WorkLog | null;
  tasks: Task[];
  leave: LeaveRequest | null;
  now?: Date;
}): DayTimeline {
  // An approved leave replaces the whole day.
  if (leave && leave.status === 'approved') {
    return {
      events: [
        {
          id: `leave-${leave.id}`,
          kind: 'leave',
          at: null,
          title: 'On leave',
          subtitle: leave.reason || null,
          color: AppTheme.violet,
          soft: AppTheme.violetSoft,
        },
      ],
      emptyReason: null,
      totalHours: null,
    };
  }

  if (!workLog) {
    const isFuture = day > now.toISOString().slice(0, 10);
    return {
      events: [],
      emptyReason: isFuture ? 'future' : 'no-record',
      totalHours: null,
    };
  }

  const events: TimelineEvent[] = [];

  if (workLog.check_in_time) {
    const accent = checkInAccent(workLog);
    events.push({
      id: `check-in-${workLog.id}`,
      kind: 'check-in',
      at: workLog.check_in_time,
      title: checkInLabel(workLog),
      subtitle: workLog.status === 'rejected'
        ? workLog.rejection_reason || workLog.check_in_plan
        : workLog.check_in_plan,
      ...accent,
    });
  }

  for (const task of tasks) {
    if (!isCompletedOnDay(task, day)) continue;
    events.push({
      id: `task-${task.id}`,
      kind: 'task',
      at: task.completed_at,
      title: task.title,
      // A completion note describes what actually happened, so it wins. Falling
      // back to the brief keeps the card from being a bare title with no
      // indication of what the task was.
      subtitle: task.completion_note || task.description,
      color: AppTheme.blue,
      soft: AppTheme.blueSoft,
    });
  }

  if (workLog.check_out_time) {
    events.push({
      id: `check-out-${workLog.id}`,
      kind: 'check-out',
      at: workLog.check_out_time,
      title: 'Checked out',
      subtitle: workLog.day_report,
      color: AppTheme.inkSoft,
      soft: AppTheme.soft,
      trailing: workLog.total_hours ? `${workLog.total_hours.toFixed(1)}h` : null,
    });
  }

  // All-day entries first, then chronological.
  events.sort((a, b) => {
    if (!a.at) return -1;
    if (!b.at) return 1;
    return a.at.localeCompare(b.at);
  });

  return {
    events,
    emptyReason: events.length === 0 ? 'no-record' : null,
    totalHours: workLog.total_hours,
  };
}

// ---------------------------------------------------------------------------
// Date rail window
//
// The rail scrolls within one month at a time, so the screens fetch exactly
// that month. Fetching anything narrower would leave scrolled-to days without
// a status dot, which reads as "absent" rather than "not loaded".
// ---------------------------------------------------------------------------

function toKey(date: Date): string {
  // Local date parts, not toISOString, which would shift the day in any
  // timezone behind UTC and drop the first/last day of the month.
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Inclusive yyyy-MM-dd bounds covering every day in `month`. */
export function getMonthRange(month: Date): { start: string; end: string } {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { start: toKey(first), end: toKey(last) };
}

/**
 * Nearest day either side of `from` that actually has a work log, so stepping
 * through days in the detail sheet never lands on an empty one. Scoped to the
 * logs already loaded, which is the month the rail is showing.
 */
export function adjacentLogDate(
  logs: { date: string }[],
  from: string,
  direction: 1 | -1
): string | null {
  const dates = logs.map((log) => log.date).sort();
  if (direction === -1) {
    const earlier = dates.filter((date) => date < from);
    return earlier.length > 0 ? earlier[earlier.length - 1] : null;
  }
  return dates.find((date) => date > from) ?? null;
}

/** Status of a single day, used for the dot under each day in the week strip. */
export type DayStatus = 'none' | 'working' | 'pending' | 'done' | 'rejected' | 'leave';

export function getDayStatus({
  workLog,
  leave,
}: {
  workLog: WorkLog | null;
  leave: LeaveRequest | null;
}): DayStatus {
  if (leave && leave.status === 'approved') return 'leave';
  if (!workLog) return 'none';
  if (workLog.status === 'rejected') return 'rejected';
  if (workLog.status === 'done') return 'done';
  if (workLog.status === 'pending_approval') return 'pending';
  return 'working';
}

export const DAY_STATUS_COLOR: Record<DayStatus, string | null> = {
  none: null,
  working: AppTheme.green,
  pending: AppTheme.amber,
  done: AppTheme.inkSoft,
  rejected: AppTheme.coral,
  leave: AppTheme.violet,
};

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  none: 'No record',
  working: 'Working',
  pending: 'Awaiting approval',
  done: 'Complete',
  rejected: 'Rejected',
  leave: 'On leave',
};
