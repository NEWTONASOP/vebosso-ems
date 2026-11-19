// ============================================================================
// VEBOSSO EMS — Event alarms on owners' phones
// Every pending client bill with a function date rings twice, like a clock
// alarm: 2 days before and 1 day before, at 11:32 AM. The phone's alarms are
// replaced with the current list whenever it is worked out again (app opened,
// Bills opened), so a changed date, a completed or trashed bill moves or
// drops its alarms. Anyone who isn't an owner has none. Android app only.
// ============================================================================

import { addDays, format, parseISO } from 'date-fns';
import * as BillAlarm from '../../modules/bill-alarm';
import type { EventAlarm } from '../../modules/bill-alarm';
import { BillSummary, fetchBills } from './bills';

export const ALARM_HOUR = 11;
export const ALARM_MINUTE = 32;
/** Days before the event. */
const DAYS_BEFORE = [2, 1];

type AlarmBill = Pick<BillSummary, 'id' | 'kind' | 'status' | 'function_date' | 'client_name' | 'event_type' | 'venue'>;

/** The alarms these bills should have, from now on. */
export function alarmsFor(bills: AlarmBill[], now = new Date()): EventAlarm[] {
  const out: EventAlarm[] = [];
  for (const b of bills) {
    if (b.kind !== 'client' || b.status !== 'pending' || !b.function_date) continue;
    const event = parseISO(b.function_date);
    const details = [b.client_name, b.event_type, b.venue, format(event, 'EEE, d MMM')].filter(Boolean).join(' · ');
    for (const days of DAYS_BEFORE) {
      const at = addDays(event, -days);
      at.setHours(ALARM_HOUR, ALARM_MINUTE, 0, 0);
      if (at <= now) continue;
      out.push({
        key: `${b.id}:${days}`,
        at: at.getTime(),
        title: days === 1 ? 'Event tomorrow' : `Event in ${days} days`,
        body: details,
        billId: b.id,
      });
    }
  }
  return out;
}

// One at a time: two syncs started together end in the same place.
let queue: Promise<void> = Promise.resolve();

/**
 * Bring this phone's alarms up to date. Owners only; anyone else's phone is
 * cleared. Pass the bills when they are already loaded, or they are fetched.
 */
export function syncBillAlarms(role: string | undefined | null, bills?: AlarmBill[]): Promise<void> {
  if (!BillAlarm.isAvailable()) return Promise.resolve();
  queue = queue
    .then(async () => {
      if (role !== 'owner') {
        BillAlarm.replaceAll([]);
        return;
      }
      let list = bills;
      if (!list) {
        const res = await fetchBills();
        if (!res.success) return; // Offline: keep what is set.
        list = res.data;
      }
      BillAlarm.replaceAll(alarmsFor(list));
    })
    .catch(() => {});
  return queue;
}

/** Signed out: no alarms on this phone. */
export const clearBillAlarms = () => {
  if (BillAlarm.isAvailable()) BillAlarm.replaceAll([]);
};

/** What is missing for the alarms to ring properly, in plain words. */
export function alarmProblems(): { which: 'exactAlarms' | 'fullScreen' | 'notifications'; text: string }[] {
  const s = BillAlarm.status();
  if (!s) return [];
  const out: { which: 'exactAlarms' | 'fullScreen' | 'notifications'; text: string }[] = [];
  if (!s.notifications) out.push({ which: 'notifications', text: 'Notifications are off for this app' });
  if (!s.exactAlarms) out.push({ which: 'exactAlarms', text: '“Alarms & reminders” is not allowed' });
  if (!s.fullScreen) out.push({ which: 'fullScreen', text: 'Full-screen alerts are not allowed' });
  return out;
}

/** "Tue 17 Nov, 11:32 AM" for the next alarm, or null. */
export function nextAlarmLabel(): string | null {
  const s = BillAlarm.status();
  return s?.next ? format(new Date(s.next), 'EEE d MMM, h:mm a') : null;
}
