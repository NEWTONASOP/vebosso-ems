// ============================================================================
// VEBOSSO EMS — Leave dates
// A leave request covers `date` to `end_date` (055); no end_date = one day.
// ============================================================================

import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { LeaveRequest } from '../types/database';

type LeaveDates = Pick<LeaveRequest, 'date'> & { end_date?: string | null };

/** The last day of the leave ("yyyy-MM-dd"). */
export const leaveEnd = (l: LeaveDates) => (l.end_date && l.end_date > l.date ? l.end_date : l.date);

/** Is the person on this leave on `day` ("yyyy-MM-dd")? */
export const leaveCovers = (l: LeaveDates, day: string) => l.date <= day && leaveEnd(l) >= day;

export const leaveDayCount = (l: LeaveDates) =>
  differenceInCalendarDays(parseISO(leaveEnd(l)), parseISO(l.date)) + 1;

/**
 * "Mon, 12 Oct" for one day; "12 – 15 Oct · 4 days", "28 Oct – 2 Nov · 6 days"
 * for several.
 */
export function leaveLabel(l: LeaveDates, oneDay = 'EEE, d MMM'): string {
  const start = parseISO(l.date);
  const end = leaveEnd(l);
  if (end === l.date) return format(start, oneDay);
  const last = parseISO(end);
  const sameMonth = format(start, 'MMM yyyy') === format(last, 'MMM yyyy');
  return `${format(start, sameMonth ? 'd' : 'd MMM')} – ${format(last, 'd MMM')} · ${leaveDayCount(l)} days`;
}

/**
 * PostgREST filter for leaves that touch the days `from`..`to`: starts on or
 * before `to` (add .lte('date', to)) and ends on or after `from` — this part.
 */
export const endsOnOrAfter = (from: string) => `end_date.gte.${from},and(end_date.is.null,date.gte.${from})`;
