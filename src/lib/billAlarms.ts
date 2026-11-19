// ============================================================================
// VEBOSSO EMS — Event alarms on owners' phones
// Every pending client bill with a function date rings twice, like a clock
// alarm: 2 days before and 1 day before, at 11:32 AM. The phone's alarms are
// replaced with the current list whenever it is worked out again (app opened,
// Bills opened), so a changed date, a completed or trashed bill moves or
// drops its alarms. Anyone who isn't an owner has none. Android app only.
// ============================================================================

import { addDays, format, parseISO } from 'date-fns';
import * as SecureStore from 'expo-secure-store';
import * as BillAlarm from '../../modules/bill-alarm';
import type { EventAlarm } from '../../modules/bill-alarm';
import { Alert } from './alert';
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

const ASKED_KEY = 'event_alarms_asked_on';
// Sent to a settings page from here: on coming back, ask for the next one
// straight away (one page per permission — Android opens one at a time).
let allowing = false;

/**
 * Owner's phone missing something the alarms need: say so, with a button to
 * the right settings page (Android has no Allow popup for these). At most
 * once a day — except straight after "Allow", to go on to the next missing
 * one. Settings → Event alarms shows it any time.
 */
export async function askForMissingAlarmPermissions(): Promise<void> {
  const problems = alarmProblems();
  if (!problems.length) {
    allowing = false;
    return;
  }
  const today = format(new Date(), 'yyyy-MM-dd');
  if (!allowing) {
    try {
      if ((await SecureStore.getItemAsync(ASKED_KEY)) === today) return;
      await SecureStore.setItemAsync(ASKED_KEY, today);
    } catch {
      // Can't remember the day: ask anyway.
    }
  }
  allowing = false;
  const time = `${ALARM_HOUR}:${String(ALARM_MINUTE).padStart(2, '0')} AM`;
  Alert.alert(
    'Allow event alarms',
    `This phone rings like an alarm at ${time}, 2 days and 1 day before each pending client bill's event. ` +
      `To ring properly it needs:\n\n• ${problems.map((p) => p.text).join('\n• ')}\n\n` +
      'Tap Allow and switch it on. You can also do this later in Settings → Event alarms.',
    [
      { text: 'Later', style: 'cancel' },
      {
        text: problems.length > 1 ? `Allow (1 of ${problems.length})` : 'Allow',
        onPress: () => {
          allowing = true;
          BillAlarm.openSettings(problems[0].which);
        },
      },
    ],
  );
}

/** "Tue 17 Nov, 11:32 AM" for the next alarm, or null. */
export function nextAlarmLabel(): string | null {
  const s = BillAlarm.status();
  return s?.next ? format(new Date(s.next), 'EEE d MMM, h:mm a') : null;
}
