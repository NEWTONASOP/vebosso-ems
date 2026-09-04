// ============================================================================
// VEBOSSO EMS — Member location for one day
// ============================================================================
// The day's route drawn from the recorded trail, with the stops named in order
// underneath. On today's date it also carries the live marker, refreshed while
// the sheet is open.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, formatDistanceToNow, isToday } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { LocationMap, MapMarker } from './LocationMap';
import { AppTheme as T, appShadow } from '../constants/theme';
import {
  buildDayTrail,
  formatDistance,
  formatDuration,
} from '../lib/locationTrail';
import { useWorkStore } from '../store/workStore';
import { LocationPing, MemberLocation } from '../types/database';

/** How often the live marker is refreshed while the sheet stays open. */
const LIVE_POLL_MS = 30_000;
/** A fix older than this is history, not "live", however the flag reads. */
const LIVE_STALE_MS = 12 * 60 * 1000;

interface MemberLocationSectionProps {
  memberId: string;
  /** The day being reviewed. */
  date: Date;
  accentColor?: string;
}

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

  const trail = useMemo(() => buildDayTrail(pings), [pings]);

  const liveAge = live ? nowTs - new Date(live.recorded_at).getTime() : null;
  const isLiveNow = !!live && live.is_tracking && liveAge != null && liveAge < LIVE_STALE_MS;

  const markers = useMemo(() => {
    const list: MapMarker[] = trail.stops.map((stop) => ({
      lat: stop.lat,
      lng: stop.lng,
      label: String(stop.index),
      title: `Stop ${stop.index} · ${format(new Date(stop.from), 'h:mm a')}–${format(
        new Date(stop.to),
        'h:mm a'
      )} · ${formatDuration(stop.minutes)}`,
      color: accentColor,
      kind: 'stop',
    }));

    if (showLive && live) {
      list.push({
        lat: live.latitude,
        lng: live.longitude,
        title: isLiveNow
          ? `Live · ${format(new Date(live.recorded_at), 'h:mm a')}`
          : `Last seen ${formatDistanceToNow(new Date(live.recorded_at), { addSuffix: true })}`,
        color: isLiveNow ? T.green : T.mute,
        kind: 'live',
      });
    }
    return list;
  }, [trail.stops, showLive, live, isLiveNow, accentColor]);

  const path = useMemo(
    () => trail.points.map((p) => ({ lat: p.lat, lng: p.lng })),
    [trail.points]
  );

  const hasAnything = path.length > 0 || markers.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Location</Text>
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

      {isLoading && pings.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={T.charcoal} />
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <LocationMap
            path={path}
            markers={markers}
            pathColor={accentColor}
            height={220}
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
                value={formatDistance(trail.distanceKm)}
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
                    ? `${format(new Date(trail.firstAt), 'h:mm a')} – ${format(
                        new Date(trail.lastAt),
                        'h:mm a'
                      )}`
                    : '—'
                }
                label="tracked"
                wide
              />
            </View>
          ) : null}

          {trail.stops.length > 0 ? (
            <View style={styles.stopList}>
              {trail.stops.map((stop) => (
                <View key={stop.id} style={styles.stopRow}>
                  <View style={[styles.stopBadge, { backgroundColor: accentColor }]}>
                    <Text style={styles.stopBadgeText}>{stop.index}</Text>
                  </View>
                  <View style={styles.stopText}>
                    <Text style={styles.stopTime}>
                      {format(new Date(stop.from), 'h:mm a')} –{' '}
                      {format(new Date(stop.to), 'h:mm a')}
                    </Text>
                    <Text style={styles.stopMeta}>
                      Stayed {formatDuration(stop.minutes)} · {stop.lat.toFixed(5)},{' '}
                      {stop.lng.toFixed(5)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
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
  card: {
    backgroundColor: T.card,
    borderRadius: 20,
    padding: 14,
    marginTop: 12,
    ...appShadow,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14.5,
    color: T.ink,
    letterSpacing: -0.2,
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
    marginTop: 12,
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
  stopList: {
    marginTop: 12,
    gap: 8,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.soft,
    borderRadius: 14,
    padding: 10,
  },
  stopBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11.5,
    color: T.white,
  },
  stopText: {
    flex: 1,
  },
  stopTime: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.ink,
  },
  stopMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    color: T.mute,
    marginTop: 1,
  },
  footnote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    color: T.mute,
    marginTop: 10,
  },
});
