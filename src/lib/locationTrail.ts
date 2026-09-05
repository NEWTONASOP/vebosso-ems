// ============================================================================
// VEBOSSO EMS — Trail analysis
// ============================================================================
// Turns a day's raw fixes into what a reviewer actually wants to read: where
// someone stayed, for how long, how far they travelled between stops, and —
// just as important — where tracking went quiet and why. A list of
// coordinates answers none of those questions on its own.
// ============================================================================

import { LocationPing } from '../types/database';

/** Fixes this far apart are the same place, not travel. */
const STOP_RADIUS_M = 80;
/** Staying inside that radius for less than this is a pause, not a stop. */
const MIN_STOP_MS = 8 * 60 * 1000;
/**
 * A fix worse than this is a cell-tower guess; drawing it as a leg of the route
 * invents journeys the member never made.
 */
const MAX_ACCURACY_M = 150;
/**
 * Pings are expected roughly every 3 minutes. A gap several times that long
 * means tracking was actually interrupted — app killed, permission revoked,
 * phone died — not just normal network jitter. Drawing a straight line across
 * a gap like that would claim a journey nobody can vouch for.
 */
const GAP_THRESHOLD_MS = 10 * 60 * 1000;
/** Below this, a gap's most likely explanation is the battery running out. */
const LOW_BATTERY_PCT = 15;

export interface TrailPoint {
  lat: number;
  lng: number;
  at: string;
  accuracy: number | null;
  /** 0–1, or null if the device didn't report it for this fix. */
  batteryLevel: number | null;
}

export interface TrailStop {
  id: string;
  lat: number;
  lng: number;
  /** ISO timestamps of the first and last fix inside the stop. */
  from: string;
  to: string;
  minutes: number;
  /** 1-based position in the day, for map labels. */
  index: number;
}

export interface TrailGap {
  from: string;
  to: string;
  minutes: number;
  /** Battery percentage (0–100) from the last fix before the gap, if known. */
  batteryBeforePct: number | null;
}

export interface DayTrail {
  /** Flat, for stats that don't care about continuity (distance excluded). */
  points: TrailPoint[];
  /** Contiguous stretches, split wherever a gap was detected — what the map
   *  actually draws as solid line, so it never implies travel across a gap. */
  segments: TrailPoint[][];
  gaps: TrailGap[];
  stops: TrailStop[];
  /** Straight-line distance within each tracked segment, in kilometres —
   *  gaps are excluded rather than guessed at. */
  distanceKm: number;
  firstAt: string | null;
  lastAt: string | null;
  /** Fixes dropped for poor accuracy — surfaced so a sparse day is explained. */
  droppedCount: number;
  /** Minutes stationary at a detected stop. */
  stoppedMinutes: number;
  /** Tracked span minus time at stops minus gap time — what's left is transit. */
  movingMinutes: number;
}

const EARTH_RADIUS_M = 6371000;

export function metresBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function buildDayTrail(pings: LocationPing[]): DayTrail {
  const sorted = [...pings].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

  const points: TrailPoint[] = [];
  let droppedCount = 0;

  for (const ping of sorted) {
    if (ping.accuracy != null && ping.accuracy > MAX_ACCURACY_M) {
      droppedCount += 1;
      continue;
    }
    points.push({
      lat: ping.latitude,
      lng: ping.longitude,
      at: ping.recorded_at,
      accuracy: ping.accuracy,
      batteryLevel: ping.battery_level,
    });
  }

  const { segments, gaps } = buildSegmentsAndGaps(points);

  let distanceKm = 0;
  for (const segment of segments) {
    for (let i = 1; i < segment.length; i++) {
      distanceKm += metresBetween(segment[i - 1], segment[i]) / 1000;
    }
  }

  const stops = buildStops(points);

  const firstAt = points[0]?.at ?? null;
  const lastAt = points[points.length - 1]?.at ?? null;
  const trackedMs =
    firstAt && lastAt ? new Date(lastAt).getTime() - new Date(firstAt).getTime() : 0;
  const stoppedMs = stops.reduce((sum, s) => sum + s.minutes * 60000, 0);
  const gapMs = gaps.reduce((sum, g) => sum + g.minutes * 60000, 0);
  const movingMs = Math.max(0, trackedMs - stoppedMs - gapMs);

  return {
    points,
    segments,
    gaps,
    stops,
    distanceKm,
    firstAt,
    lastAt,
    droppedCount,
    stoppedMinutes: Math.round(stoppedMs / 60000),
    movingMinutes: Math.round(movingMs / 60000),
  };
}

/**
 * Splits the day into contiguous tracked stretches wherever consecutive fixes
 * are further apart in time than GAP_THRESHOLD_MS. Each gap carries the
 * battery reading from just before it, which is usually enough to tell "the
 * phone died" apart from "tracking was turned off" without guessing.
 */
function buildSegmentsAndGaps(points: TrailPoint[]): {
  segments: TrailPoint[][];
  gaps: TrailGap[];
} {
  if (points.length === 0) return { segments: [], gaps: [] };

  const segments: TrailPoint[][] = [[points[0]]];
  const gaps: TrailGap[] = [];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const gapMs = new Date(curr.at).getTime() - new Date(prev.at).getTime();

    if (gapMs > GAP_THRESHOLD_MS) {
      gaps.push({
        from: prev.at,
        to: curr.at,
        minutes: Math.round(gapMs / 60000),
        batteryBeforePct:
          prev.batteryLevel != null ? Math.round(prev.batteryLevel * 100) : null,
      });
      segments.push([curr]);
    } else {
      segments[segments.length - 1].push(curr);
    }
  }

  return { segments, gaps };
}

/** A short, human explanation for why tracking stopped — not just that it did. */
/**
 * The low-battery case is a fairly confident inference — pings simply stop
 * right as the battery reading was critical. Beyond that we genuinely don't
 * know: tracking runs as an Android foreground service specifically so it
 * survives the app being closed, so "the app was closed" is usually not even
 * the real cause. The more common real-world culprit is the device's own
 * battery-saver killing the background service outright — Xiaomi, Oppo,
 * Samsung and others are known to do this even when an app follows every
 * Android API correctly. None of that is visible from a timing gap alone, so
 * this reports uncertainty rather than guessing a specific cause.
 */
export function describeGapReason(gap: TrailGap): string {
  if (gap.batteryBeforePct != null && gap.batteryBeforePct <= LOW_BATTERY_PCT) {
    return `battery was at ${gap.batteryBeforePct}%, likely died`;
  }
  return "cause unknown — could be a permission change or the device's battery saver pausing it";
}

/**
 * Walk the day forward, growing a cluster while each new fix stays within
 * STOP_RADIUS_M of the cluster's anchor. A cluster that spans MIN_STOP_MS
 * becomes a stop, positioned at the mean of its fixes. Runs over every fix
 * regardless of gaps — a tracking blip at a desk is still one stop, not two.
 */
function buildStops(points: TrailPoint[]): TrailStop[] {
  const stops: TrailStop[] = [];
  let cluster: TrailPoint[] = [];

  const flush = () => {
    if (cluster.length < 2) {
      cluster = [];
      return;
    }
    const from = cluster[0].at;
    const to = cluster[cluster.length - 1].at;
    const ms = new Date(to).getTime() - new Date(from).getTime();
    if (ms < MIN_STOP_MS) {
      cluster = [];
      return;
    }

    const lat = cluster.reduce((sum, p) => sum + p.lat, 0) / cluster.length;
    const lng = cluster.reduce((sum, p) => sum + p.lng, 0) / cluster.length;

    stops.push({
      id: `${from}-${to}`,
      lat,
      lng,
      from,
      to,
      minutes: Math.round(ms / 60000),
      index: stops.length + 1,
    });
    cluster = [];
  };

  for (const point of points) {
    if (cluster.length === 0) {
      cluster = [point];
      continue;
    }
    if (metresBetween(cluster[0], point) <= STOP_RADIUS_M) {
      cluster.push(point);
    } else {
      flush();
      cluster = [point];
    }
  }
  flush();

  return stops;
}

/** "2h 15m" / "45m" — durations read faster than raw minutes. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** "850 m" below a kilometre, "12.4 km" above it. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
