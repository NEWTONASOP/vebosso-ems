// ============================================================================
// VEBOSSO EMS — Background location tracking
// ============================================================================
// Tracking runs only between check-in and check-out. Every fix is appended to
// location_pings; a database trigger keeps member_locations (the live marker)
// in step, so one write per fix is all the device does.
//
// The task is defined at module scope: Android may relaunch the JS context
// headless to deliver a fix, and a task that is not registered by the time the
// bundle finishes evaluating is dropped.
// ============================================================================

import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export const LOCATION_TASK = 'vebosso-location-tracking';

/** Chosen with battery in mind: a fix every 3 minutes, or every 100 m moved. */
const TIME_INTERVAL_MS = 3 * 60 * 1000;
const DISTANCE_INTERVAL_M = 100;

/** Where the task finds the work log a fix belongs to. */
const SESSION_KEY = 'vebosso.location.session';
/** Fixes that could not be uploaded, replayed on the next successful upload. */
const QUEUE_KEY = 'vebosso.location.queue';
/** A queue larger than this is old news; the newest fixes matter more. */
const QUEUE_LIMIT = 200;

export interface TrackingSession {
  userId: string;
  workLogId: string | null;
  date: string;
}

interface PingRow {
  user_id: string;
  work_log_id: string | null;
  date: string;
  recorded_at: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  battery_level: number | null;
  is_moving: boolean | null;
}

// ── Session handle ──────────────────────────────────────────────────────────

async function readSession(): Promise<TrackingSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? (JSON.parse(raw) as TrackingSession) : null;
  } catch {
    return null;
  }
}

async function writeSession(session: TrackingSession | null): Promise<void> {
  try {
    if (session) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  } catch {
    // A missing session only costs the work_log_id on later pings.
  }
}

// ── Offline queue ───────────────────────────────────────────────────────────

async function readQueue(): Promise<PingRow[]> {
  try {
    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PingRow[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(rows: PingRow[]): Promise<void> {
  try {
    if (rows.length === 0) {
      await SecureStore.deleteItemAsync(QUEUE_KEY);
    } else {
      await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(rows.slice(-QUEUE_LIMIT)));
    }
  } catch {
    // Dropping the queue is preferable to blocking the next fix.
  }
}

/**
 * The insert policy rejects anything older than a day, so a stale queue would
 * fail forever and hold newer fixes behind it. Drop what can no longer land.
 */
function dropExpired(rows: PingRow[]): PingRow[] {
  const cutoff = Date.now() - 23 * 60 * 60 * 1000;
  return rows.filter((row) => new Date(row.recorded_at).getTime() >= cutoff);
}

async function batteryLevel(): Promise<number | null> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    return level >= 0 ? level : null;
  } catch {
    return null;
  }
}

/**
 * Insert, and on failure keep the rows for the next fix. `upsert` with
 * ignoreDuplicates absorbs a queue replay landing twice — (user_id,
 * recorded_at) is unique in the database.
 */
async function upload(rows: PingRow[]): Promise<boolean> {
  if (rows.length === 0) return true;
  try {
    const { error } = await supabase
      .from('location_pings')
      .upsert(rows as any, { onConflict: 'user_id,recorded_at', ignoreDuplicates: true });
    if (error) throw error;
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[location] upload failed:', error);
    return false;
  }
}

function toRow(
  location: Location.LocationObject,
  session: TrackingSession,
  battery: number | null
): PingRow {
  const recordedAt = new Date(location.timestamp);
  return {
    user_id: session.userId,
    work_log_id: session.workLogId,
    date: session.date,
    recorded_at: recordedAt.toISOString(),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy ?? null,
    altitude: location.coords.altitude ?? null,
    speed: location.coords.speed ?? null,
    heading: location.coords.heading ?? null,
    battery_level: battery,
    // Below ~1 m/s is a person standing still, not travelling.
    is_moving: location.coords.speed == null ? null : location.coords.speed > 1,
  };
}

// ── The task ────────────────────────────────────────────────────────────────

// Web has no background task runtime; defining the task there logs an error on
// every reload and can never fire.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      if (__DEV__) console.warn('[location] task error:', error.message);
      return;
    }

    const locations = (data as { locations?: Location.LocationObject[] } | null)?.locations;
    if (!locations?.length) return;

    const session = await readSession();
    if (!session) {
      // Tracking outlived its check-in (e.g. the app was killed mid-session).
      await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
      return;
    }

    const battery = await batteryLevel();
    const fresh = locations.map((loc) => toRow(loc, session, battery));
    const queued = await readQueue();
    const pending = dropExpired([...queued, ...fresh]);

    const ok = await upload(pending);
    await writeQueue(ok ? [] : pending);
  });
}

// ── Permissions ─────────────────────────────────────────────────────────────

export interface LocationPermissionState {
  foreground: boolean;
  background: boolean;
  /** The OS will not prompt again; the user has to go to Settings. */
  blocked: boolean;
  /**
   * The untouched native responses, kept only for on-screen diagnostics when
   * a request resolves without granting anything — `status`/`canAskAgain`
   * distinguish "the user tapped Deny" from "the dialog never appeared" in a
   * way the three booleans above collapse away.
   */
  raw?: { foreground: unknown; background?: unknown };
}

export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  const foreground = await Location.getForegroundPermissionsAsync();
  // Asking for the background status before the foreground grant throws on
  // some Android builds, and its answer is meaningless anyway.
  const background = foreground.granted
    ? await Location.getBackgroundPermissionsAsync()
    : { granted: false, canAskAgain: true };

  return {
    foreground: foreground.granted,
    background: background.granted,
    blocked:
      (!foreground.granted && !foreground.canAskAgain) ||
      (foreground.granted && !background.granted && !background.canAskAgain),
  };
}

/**
 * Foreground first, then background — Android requires the two prompts in that
 * order, and on Android 11+ the background one opens Settings rather than a
 * dialog.
 */
/**
 * If the OS dialog never appears — as opposed to appearing and being denied —
 * the underlying native call can sit pending forever with nothing to catch.
 * Racing it against a timeout turns an indefinitely spinning button into a
 * concrete, reportable failure instead of silence.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} did not respond within ${ms / 1000}s.`)),
        ms
      )
    ),
  ]);
}

export async function requestLocationPermissions(): Promise<LocationPermissionState> {
  const foreground = await withTimeout(
    Location.requestForegroundPermissionsAsync(),
    15000,
    'Location permission request'
  );
  if (!foreground.granted) {
    return {
      foreground: false,
      background: false,
      blocked: !foreground.canAskAgain,
      raw: { foreground },
    };
  }

  // Same gap as before the foreground request: firing the background prompt
  // in the same tick the foreground one closes can make Android silently drop
  // it while the Activity is still settling back to resumed.
  await new Promise((resolve) => setTimeout(resolve, 400));

  const background = await withTimeout(
    Location.requestBackgroundPermissionsAsync(),
    15000,
    'Background location permission request'
  );
  return {
    foreground: true,
    background: background.granted,
    blocked: !background.granted && !background.canAskAgain,
    raw: { foreground, background },
  };
}

export async function isLocationServicesEnabled(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

// ── Start / stop ────────────────────────────────────────────────────────────

export async function isTrackingRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}

/**
 * Begin tracking for a checked-in member. Safe to call when already running —
 * it refreshes the work log the fixes are attributed to.
 */
export async function startLocationTracking(session: TrackingSession): Promise<boolean> {
  const state = await getLocationPermissionState();
  if (!state.foreground || !state.background) return false;

  await writeSession(session);

  if (await isTrackingRunning()) return true;

  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: TIME_INTERVAL_MS,
      distanceInterval: DISTANCE_INTERVAL_M,
      // Standing still must not end the day's trail.
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
      showsBackgroundLocationIndicator: true,
      // Android will not run background location without a visible
      // notification, so this text is mandatory rather than a choice.
      foregroundService: {
        notificationTitle: 'VEBOSSO EMS — checked in',
        notificationBody: 'Attendance is running until you check out.',
        notificationColor: '#2563EB',
        killServiceOnDestroy: false,
      },
      // Batching on iOS costs freshness on the live view for little battery.
      deferredUpdatesInterval: Platform.OS === 'android' ? TIME_INTERVAL_MS : 0,
      deferredUpdatesDistance: Platform.OS === 'android' ? DISTANCE_INTERVAL_M : 0,
    });
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[location] failed to start tracking:', error);
    return false;
  }
}

/** Stop tracking and drop the live marker back to "last seen". */
export async function stopLocationTracking(): Promise<void> {
  try {
    if (await isTrackingRunning()) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch (error) {
    if (__DEV__) console.warn('[location] failed to stop tracking:', error);
  }

  // Flush whatever the task could not send before the trail ends.
  const queued = dropExpired(await readQueue());
  if (queued.length > 0 && (await upload(queued))) {
    await writeQueue([]);
  }

  await writeSession(null);
  try {
    await supabase.rpc('end_location_tracking');
  } catch (error) {
    if (__DEV__) console.warn('[location] failed to clear live marker:', error);
  }
}

/**
 * One immediate fix, so a just-checked-in member appears on the live map
 * without waiting for the first background interval.
 */
export async function pushCurrentLocation(session: TrackingSession): Promise<void> {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const row = toRow(location, session, await batteryLevel());
    if (!(await upload([row]))) {
      await writeQueue([...(await readQueue()), row]);
    }
  } catch (error) {
    if (__DEV__) console.warn('[location] immediate fix failed:', error);
  }
}

/**
 * Restart tracking after an app relaunch if the member is still checked in —
 * the OS drops the task when the app is force-stopped.
 */
export async function resumeTrackingIfCheckedIn(session: TrackingSession): Promise<void> {
  if (await isTrackingRunning()) {
    await writeSession(session);
    return;
  }
  await startLocationTracking(session);
}
