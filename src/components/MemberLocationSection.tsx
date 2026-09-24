// ============================================================================
// VEBOSSO EMS — Member location for one day
// ============================================================================
// The day's route drawn from the recorded trail, with stops and tracking gaps
// laid out as one chronological timeline underneath — by place name where one
// can be resolved, coordinates always shown alongside it. On today's date it
// also carries the live marker, refreshed while the sheet is open. A gap is
// shown rather than papered over: a dashed line on the map and an entry in the
// timeline saying roughly why (battery, or the app/permission being turned
// off), instead of a solid line implying a journey nobody can vouch for.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { LocationMap, MapGap, MapMarker } from './LocationMap';
import { AppTheme as T, appShadow } from '../constants/theme';
import {
  buildDayTrail,
  describeGapReason,
  formatDistance,
  formatDuration,
  TrailGap,
  TrailStop,
} from '../lib/locationTrail';
import { reverseGeocodeStop } from '../lib/reverseGeocode';
import { useWorkStore } from '../store/workStore';
import { LocationPing, MemberLocation } from '../types/database';

/** How often the live marker is refreshed while the sheet stays open. */
const LIVE_POLL_MS = 30_000;
/** A fix older than this is history, not "live", however the flag reads. */
const LIVE_STALE_MS = 12 * 60 * 1000;

/** "9:40 PM", or "12:30 AM (next day)" once past the reviewed day's midnight. */
function timeOnDay(iso: string, dayKey: string): string {
  const d = new Date(iso);
  const label = format(d, 'h:mm a');
  return format(d, 'yyyy-MM-dd') > dayKey ? `${label} (next day)` : label;
}

interface MemberLocationSectionProps {
  memberId: string;
  /** The day being reviewed. */
  date: Date;
  accentColor?: string;
}

type TimelineEntry =
  | { kind: 'stop'; at: string; stop: TrailStop }
  | { kind: 'gap'; at: string; gap: TrailGap; displacementKm: number | null };

export function MemberLocationSection({
  memberId,
  date,
  accentColor = T.blue,
}: MemberLocationSectionProps) {
  const { fetchDayLocations, fetchLiveLocations } = useWorkStore();

  const [pings, setPings] = useState<LocationPing[]>([]);
  const [live, setLive] = useState<MemberLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // "Live" is a claim about now, so the clock it is measured against has to be
  // state — reading Date.now() during render makes the badge depend on when
  // React happened to re-render.
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  // Keyed by stop id; a stop renders its coordinates until (if ever) a name
  // resolves, so a slow or failed lookup never blocks the rest of the screen.
  const [stopNames, setStopNames] = useState<Record<string, string>>({});
  // The list under the map is detail — closed until asked for.
  const [stayOpen, setStayOpen] = useState(false);

  const dayKey = format(date, 'yyyy-MM-dd');
  const showLive = isToday(date);

  const loadDay = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const res = await fetchDayLocations(memberId, dayKey);
    if (res.success) {
      setPings(res.data);
    } else {
      setError(res.error || 'Failed to load location history.');
      setPings([]);
    }
    setIsLoading(false);
  }, [memberId, dayKey, fetchDayLocations]);

  const loadLive = useCallback(async () => {
    const res = await fetchLiveLocations();
    if (!res.success) return;
    setLive(res.data.find((row) => row.user_id === memberId) ?? null);
    setNowTs(Date.now());
  }, [memberId, fetchLiveLocations]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  useEffect(() => {
    if (!showLive) {
      setLive(null);
      return;
    }
    void loadLive();
    const id = setInterval(() => {
      void loadLive();
      // The trail grows while the day is open, so the route follows along.
      void loadDay();
    }, LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [showLive, loadLive, loadDay]);

  // Clipped to the reviewed day, so another day's movements never leak in.
  const trail = useMemo(() => buildDayTrail(pings, dayKey), [pings, dayKey]);

  // Resolved lazily and one at a time (see reverseGeocodeStop's own queue) —
  // a day rarely has more than a handful of stops, so this never becomes a
  // visible delay, and the module-level cache means switching back to a day
  // already viewed costs nothing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const stop of trail.stops) {
        if (cancelled) return;
        const name = await reverseGeocodeStop(stop.lat, stop.lng);
        if (!cancelled && name) {
          setStopNames((prev) => (prev[stop.id] === name ? prev : { ...prev, [stop.id]: name }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trail.stops]);

  const liveAge = live ? nowTs - new Date(live.recorded_at).getTime() : null;
  const isLiveNow = !!live && live.is_tracking && liveAge != null && liveAge < LIVE_STALE_MS;

  // The live row is fresher than the trail on a day still in progress; a past
  // day has no live row at all, so the trail's own last fix is all there is.
  const lastBatteryLevel =
    showLive && live?.battery_level != null
      ? live.battery_level
      : (trail.points[trail.points.length - 1]?.batteryLevel ?? null);
  const lastBatteryPct = lastBatteryLevel != null ? Math.round(lastBatteryLevel * 100) : null;
  const batteryColor =
    lastBatteryPct == null ? T.mute : lastBatteryPct <= 15 ? T.coral : lastBatteryPct <= 40 ? T.amber : T.green;

  const markers = useMemo(() => {
    const list: MapMarker[] = trail.stops.map((stop) => ({
      lat: stop.lat,
      lng: stop.lng,
      label: String(stop.index),
      title: `Stop ${stop.index} · ${timeOnDay(stop.from, dayKey)}–${timeOnDay(stop.to, dayKey)} · ${formatDuration(
        stop.minutes
      )}${stopNames[stop.id] ? ` · ${stopNames[stop.id]}` : ''}`,
      color: accentColor,
      kind: 'stop',
    }));

    // Start marker at the very first tracked fix
    if (trail.points.length > 0) {
      const first = trail.points[0];
      list.push({
        lat: first.lat,
        lng: first.lng,
        kind: 'start',
        title: `Started tracking · ${timeOnDay(first.at, dayKey)}`,
      });
    }

    // End marker at the very last tracked fix (only when not live / checked out)
    if (!showLive && trail.points.length > 1) {
      const last = trail.points[trail.points.length - 1];
      list.push({
        lat: last.lat,
        lng: last.lng,
        kind: 'end',
        title: `Last tracked · ${timeOnDay(last.at, dayKey)}`,
      });
    }

    if (showLive && live) {
      list.push({
        lat: live.latitude,
        lng: live.longitude,
        title: isLiveNow
          ? `Live · ${format(new Date(live.recorded_at), 'h:mm a')}`
          : `Last seen ${formatDistanceToNow(new Date(live.recorded_at), { addSuffix: true })}`,
        color: isLiveNow ? T.green : T.mute,
        kind: 'live',
        accuracyM: live.accuracy ?? undefined,
      });
    }
    return list;
  }, [trail.stops, trail.points, stopNames, showLive, live, isLiveNow, accentColor, dayKey]);

  const mapSegments = useMemo(
    () => trail.segments.map((segment) => segment.map((p) => ({ lat: p.lat, lng: p.lng }))),
    [trail.segments]
  );

  // Build annotated gap connectors for the map — each gap gets a popup label
  // with its duration and the minimum displacement measured across it.
  const mapGaps = useMemo<MapGap[]>(
    () =>
      trail.gaps
        .filter((g) => !g.still && g.fromPoint && g.toPoint)
        .map((g) => ({
          from: g.fromPoint!,
          to: g.toPoint!,
          label: [
            `Duration: ${formatDuration(g.minutes)}`,
            g.gapDisplacementKm != null && g.gapDisplacementKm > 0.05
              ? `Moved at least ${formatDistance(g.gapDisplacementKm)} (straight line)`
              : null,
            describeGapReason(g),
          ]
            .filter(Boolean)
            .join('<br/>'),
        })),
    [trail.gaps]
  );

  // Stops and gaps read as one story in the order they happened, not as two
  // differently-styled lists stacked on top of each other.
  const timeline = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = [
      ...trail.stops.map((stop): TimelineEntry => ({ kind: 'stop', at: stop.from, stop })),
      ...trail.gaps.map((gap): TimelineEntry => ({
        kind: 'gap',
        at: gap.from,
        gap,
        displacementKm: gap.gapDisplacementKm,
      })),
    ];
    return entries.sort((a, b) => a.at.localeCompare(b.at));
  }, [trail.stops, trail.gaps]);

  const hasAnything = trail.points.length > 0 || markers.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Location</Text>
          <Text style={styles.dateLabel} numberOfLines={1}>
            {isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'EEE, d MMM yyyy')}
          </Text>
        </View>
        <View style={styles.headBadges}>
          {lastBatteryPct != null ? (
            <View style={styles.batteryChip}>
              <Feather name="battery" size={11} color={batteryColor} />
              <Text style={[styles.batteryText, { color: batteryColor }]}>{lastBatteryPct}%</Text>
            </View>
          ) : null}
          {showLive ? (
            <View style={[styles.liveChip, isLiveNow ? styles.liveOn : styles.liveOff]}>
              <View
                style={[styles.liveDot, { backgroundColor: isLiveNow ? T.green : T.mute }]}
              />
              <Text style={[styles.liveText, { color: isLiveNow ? T.green : T.mute }]}>
                {isLiveNow
                  ? 'Live'
                  : live
                    ? `Last seen ${formatDistanceToNow(new Date(live.recorded_at), { addSuffix: true })}`
                    : 'Not tracking'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {isLoading && pings.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={T.charcoal} />
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <LocationMap
            segments={mapSegments}
            gaps={mapGaps}
            markers={markers}
            pathColor={accentColor}
            height={280}
            emptyLabel={
              showLive
                ? 'Nothing recorded yet today. Tracking starts at check-in.'
                : 'No location recorded for this day.'
            }
          />

          {hasAnything ? (
            <View style={styles.statsRow}>
              <Stat
                icon="map"
                value={formatDistance(trail.totalDistanceKm)}
                label="travelled"
              />
              <View style={styles.statDivider} />
              <Stat
                icon="map-pin"
                value={String(trail.stops.length)}
                label={trail.stops.length === 1 ? 'stop' : 'stops'}
              />
              <View style={styles.statDivider} />
              <Stat
                icon="clock"
                value={
                  trail.firstAt && trail.lastAt
                    ? formatDuration(
                        Math.round(
                          (new Date(trail.lastAt).getTime() - new Date(trail.firstAt).getTime()) / 60000
                        )
                      )
                    : '—'
                }
                label="tracked"
              />
            </View>
          ) : null}

          {trail.firstAt && trail.lastAt ? (
            <Text style={styles.splitLine}>
              {timeOnDay(trail.firstAt, dayKey)} → {timeOnDay(trail.lastAt, dayKey)}
              {trail.movingMinutes > 0 ? ` · ${formatDuration(trail.movingMinutes)} travelling` : ''}
            </Text>
          ) : null}

          {timeline.length > 0 ? (
            <View style={styles.timelineSection}>
              <Pressable
                onPress={() => setStayOpen((o) => !o)}
                style={({ pressed }) => [styles.stayToggle, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityState={{ expanded: stayOpen }}
                accessibilityLabel="Where they stayed"
              >
                <Text style={[styles.sectionLabel, styles.stayLabel]}>Where they stayed</Text>
                <Text style={styles.stayCount}>
                  {[
                    trail.stops.length
                      ? `${trail.stops.length} ${trail.stops.length === 1 ? 'stop' : 'stops'}`
                      : null,
                    trail.gaps.length ? `${trail.gaps.length} location off` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Feather name={stayOpen ? 'chevron-up' : 'chevron-down'} size={16} color={T.mute} />
              </Pressable>
              {stayOpen ? (
              <View style={styles.timeline}>
                {timeline.map((entry, index) => {
                  const isLast = index === timeline.length - 1;
                  return entry.kind === 'stop' ? (
                    <StopRow
                      key={entry.stop.id}
                      dayKey={dayKey}
                      stop={entry.stop}
                      name={stopNames[entry.stop.id]}
                      accentColor={accentColor}
                      isLast={isLast}
                    />
                  ) : (
                    <GapRow
                      key={`${entry.gap.from}-${entry.gap.to}`}
                      dayKey={dayKey}
                      gap={entry.gap}
                      displacementKm={entry.displacementKm}
                      isLast={isLast}
                    />
                  );
                })}
              </View>
              ) : null}
            </View>
          ) : null}

          {trail.outsideDayCount > 0 ? (
            <Text style={styles.footnote}>
              {trail.outsideDayCount} {trail.outsideDayCount === 1 ? 'fix' : 'fixes'} from another day
              left out.
            </Text>
          ) : null}

          {trail.droppedCount > 0 ? (
            <Text style={styles.footnote}>
              {trail.droppedCount} low-accuracy {trail.droppedCount === 1 ? 'fix' : 'fixes'}{' '}
              hidden.
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function StopRow({
  stop,
  dayKey,
  name,
  accentColor,
  isLast,
}: {
  stop: TrailStop;
  dayKey: string;
  name?: string;
  accentColor: string;
  isLast: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={[styles.stopBadge, { backgroundColor: accentColor }]}>
        <Text style={styles.stopBadgeText}>{stop.index}</Text>
      </View>
      <View style={[styles.timelineText, isLast && styles.timelineTextLast]}>
        <View style={styles.timelineHeadRow}>
          <Text style={styles.timelineTime}>
            {timeOnDay(stop.from, dayKey)} – {timeOnDay(stop.to, dayKey)}
          </Text>
          <Text style={styles.timelineDuration}>Stayed {formatDuration(stop.minutes)}</Text>
        </View>
        <Text style={styles.timelinePlace} numberOfLines={1}>
          {name ?? 'Locating…'}
        </Text>
        <Text style={styles.timelineCoords}>
          {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
        </Text>
        {stop.quietMinutes >= 30 ? (
          <Text style={styles.quietNote}>
            No updates for {formatDuration(stop.quietMinutes)} of this — normal when a phone sits idle.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function GapRow({
  gap,
  dayKey,
  displacementKm,
  isLast,
}: {
  gap: TrailGap;
  dayKey: string;
  displacementKm: number | null;
  isLast: boolean;
}) {
  const moved =
    displacementKm != null && displacementKm > 0.05
      ? `Moved at least ${formatDistance(displacementKm)} while location was off.`
      : '';
  const body = [moved, describeGapReason(gap)].filter(Boolean).join(' ');
  return (
    <View style={[styles.timelineRow, styles.gapRow]}>
      <View style={styles.gapBadge}>
        <Feather name="alert-triangle" size={12} color={T.amber} />
      </View>
      <View style={[styles.timelineText, isLast && styles.timelineTextLast]}>
        <View style={styles.timelineHeadRow}>
          <Text style={[styles.timelineTime, styles.gapTime]}>
            {timeOnDay(gap.from, dayKey)} – {timeOnDay(gap.to, dayKey)}
          </Text>
          <Text style={[styles.timelineDuration, styles.gapTime]}>
            {formatDuration(gap.minutes)}
          </Text>
        </View>
        <Text style={[styles.timelinePlace, styles.gapTitle]}>Location off</Text>
        {body ? <Text style={styles.gapBody}>{body}</Text> : null}
      </View>
    </View>
  );
}

function Stat({
  icon,
  value,
  label,
  wide,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  value: string;
  label: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.stat, wide && styles.statWide]}>
      <Feather name={icon} size={13} color={T.mute} />
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
  },
  stayLabel: {
    flex: 1,
    marginBottom: 0,
  },
  stayCount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
    color: T.mute,
  },
  quietNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: T.mute,
    marginTop: 4,
    lineHeight: 17,
  },
  gapTitle: {
    fontFamily: 'Inter_600SemiBold',
  },
  gapBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: T.inkSoft,
    marginTop: 2,
    lineHeight: 18,
  },
  card: {
    backgroundColor: T.card,
    borderRadius: 20,
    padding: 14,
    marginTop: 12,
    marginBottom: 14,
    ...appShadow,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14.5,
    color: T.ink,
    letterSpacing: -0.2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexShrink: 1,
  },
  dateLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
    color: T.mute,
    flexShrink: 1,
  },
  headBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  batteryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11.5,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  liveOn: {
    backgroundColor: T.greenSoft,
  },
  liveOff: {
    backgroundColor: T.soft,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11.5,
  },
  loading: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.coral,
    paddingVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statWide: {
    flex: 1.6,
  },
  statValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: T.ink,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: T.mute,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
    backgroundColor: T.soft,
  },
  splitLine: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    color: T.mute,
    textAlign: 'center',
    marginTop: 8,
  },
  timelineSection: {
    marginTop: 16,
  },
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: T.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  timeline: {
    gap: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timelineText: {
    flex: 1,
    // A hairline bottom border per row (instead of a filled card each) is
    // what actually removes the "boxes stacked on boxes" feeling — the list
    // reads as one continuous timeline rather than a pile of separate cards.
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.soft,
  },
  timelineTextLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  timelineHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  timelineTime: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.ink,
  },
  timelineDuration: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11.5,
    color: T.mute,
  },
  timelinePlace: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: T.inkSoft,
    marginTop: 2,
  },
  timelineCoords: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10.5,
    color: T.mute,
    marginTop: 1,
  },
  stopBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stopBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: T.white,
  },
  gapRow: {
    // Sits between two rows drawing their own top-adjacent border, so a
    // little extra breathing room keeps the warning from feeling squeezed.
    paddingTop: 2,
  },
  gapBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    backgroundColor: T.amberSoft,
  },
  gapTime: {
    color: T.amber,
  },
  footnote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: T.mute,
    marginTop: 12,
  },
});
