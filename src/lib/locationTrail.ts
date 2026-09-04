// ============================================================================
// VEBOSSO EMS — Trail analysis
// ============================================================================
// Turns a day's raw fixes into what a reviewer actually wants to read: where
// someone stayed, for how long, and how far they travelled between stops. A
// list of coordinates answers none of those questions on its own.
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

export interface TrailPoint {
  lat: number;
  lng: number;
  at: string;
  accuracy: number | null;
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

export interface DayTrail {
  points: TrailPoint[];
  stops: TrailStop[];
  /** Straight-line distance between consecutive fixes, in kilometres. */
  distanceKm: number;
  firstAt: string | null;
  lastAt: string | null;
  /** Fixes dropped for poor accuracy — surfaced so a sparse day is explained. */
  droppedCount: number;
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
    });
  }

  let distanceKm = 0;
  for (let i = 1; i < points.length; i++) {
    distanceKm += metresBetween(points[i - 1], points[i]) / 1000;
  }

  return {
    points,
    stops: buildStops(points),
    distanceKm,
    firstAt: points[0]?.at ?? null,
    lastAt: points[points.length - 1]?.at ?? null,
    droppedCount,
  };
}

/**
 * Walk the day forward, growing a cluster while each new fix stays within
 * STOP_RADIUS_M of the cluster's anchor. A cluster that spans MIN_STOP_MS
 * becomes a stop, positioned at the mean of its fixes.
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
