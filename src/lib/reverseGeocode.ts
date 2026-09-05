// ============================================================================
// VEBOSSO EMS — Reverse geocoding for stop names
// ============================================================================
// Turns a stop's raw coordinates into something a reviewer can actually read
// ("MG Road, Sector 14" instead of "28.64670, 77.51222"). Uses OpenStreetMap's
// Nominatim over plain HTTP — same free provider as the map tiles, so this
// needs no API key and no billing account, matching the rest of the location
// feature's design.
//
// Deliberately NOT expo-location's device geocoder: that runs on the
// *viewer's* phone and requires *that* device to hold location permission,
// which owners and managers were never asked to grant (only members are
// gated). An HTTP call has no such dependency.
// ============================================================================

/** ~11 m grid — enough to treat repeat views of the same stop as a cache hit. */
function roundKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

const cache = new Map<string, string | null>();

/**
 * Nominatim's usage policy caps public, unauthenticated use at ~1 request per
 * second. A day's stop list is short enough that this queue never becomes a
 * visible delay, and it keeps the app a well-behaved anonymous client rather
 * than something that could get the shared endpoint rate-limited or blocked.
 */
let queue: Promise<void> = Promise.resolve();
const MIN_INTERVAL_MS = 1100;

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task);
  queue = result.then(
    () => new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS)),
    () => new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS))
  );
  return result;
}

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  county?: string;
  state?: string;
}

/**
 * Resolves to a short place label ("MG Road, Sector 14"), or null if the
 * request fails or the API has nothing useful — callers fall back to raw
 * coordinates in that case, so a network hiccup never blocks the screen.
 */
export async function reverseGeocodeStop(lat: number, lng: number): Promise<string | null> {
  const key = roundKey(lat, lng);
  if (cache.has(key)) return cache.get(key) ?? null;

  const label = await enqueue(async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          // Required by Nominatim's usage policy — identifies the app to
          // whoever operates the shared endpoint, not tied to any user.
          'User-Agent': 'VEBOSSO-EMS-Attendance/1.0',
          Accept: 'application/json',
        },
      });
      if (!response.ok) return null;

      const data = (await response.json()) as {
        address?: NominatimAddress;
        display_name?: string;
      };
      const address = data.address ?? {};

      const primary =
        address.road ?? address.pedestrian ?? address.neighbourhood ?? address.village;
      const secondary = address.suburb ?? address.city ?? address.town ?? address.county;

      const parts = [primary, secondary].filter(
        (value, index, all): value is string => !!value && all.indexOf(value) === index
      );

      if (parts.length > 0) return parts.join(', ');
      if (data.display_name) return data.display_name.split(',').slice(0, 2).join(',').trim();
      return null;
    } catch {
      return null;
    }
  });

  cache.set(key, label);
  return label;
}
