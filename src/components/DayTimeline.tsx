// ============================================================================
// VEBOSSO EMS — Attendance day timeline
// Sequential agenda: real times in the left gutter, event cards with a coloured
// accent rail. Sequential rather than to-scale, because an attendance day holds
// only a handful of timestamps and an hour grid would be mostly empty.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import React, { useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import {
  DayTimeline as DayTimelineData,
  EmptyDayReason,
  TimelineEvent,
  TimelineEventKind,
} from '../lib/attendanceTimeline';
import { AppTheme, appSoftShadow } from '../constants/theme';

const KIND_ICON: Record<TimelineEventKind, React.ComponentProps<typeof Feather>['name']> = {
  'check-in': 'log-in',
  task: 'check-circle',
  'check-out': 'log-out',
  leave: 'sun',
};

/**
 * Check-in and check-out titles say what they are ("Checked in"), but a task
 * card shows only the task's own title, which is indistinguishable from any
 * other entry. Those get an explicit label.
 */
const KIND_LABEL: Partial<Record<TimelineEventKind, string>> = {
  task: 'Task completed',
};

/**
 * Long notes are collapsed to keep the day scannable. Measuring the rendered
 * text would be exact but `onTextLayout` is unreliable on web, so the
 * affordance appears past a length that reliably wraps beyond the clamp.
 */
const CLAMPED_LINES = 3;
const LIKELY_CLAMPED = 130;

const EMPTY_COPY: Record<EmptyDayReason, { title: string; body: string }> = {
  future: {
    title: 'Nothing here yet',
    body: 'This day hasn’t happened. Check back once the day begins.',
  },
  'no-record': {
    title: 'No attendance recorded',
    body: 'There’s no check-in for this day.',
  },
};

interface DayTimelineProps {
  timeline: DayTimelineData;
  /** Optional tap-through, e.g. to open the full work log detail. */
  onPressEvent?: (event: TimelineEvent) => void;
}

export function DayTimeline({ timeline, onPressEvent }: DayTimelineProps) {
  if (timeline.events.length === 0) {
    const copy = EMPTY_COPY[timeline.emptyReason ?? 'no-record'];
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Feather name="calendar" size={20} color={AppTheme.mute} />
        </View>
        <Text style={styles.emptyTitle}>{copy.title}</Text>
        <Text style={styles.emptyBody}>{copy.body}</Text>
      </View>
    );
  }

  return (
    <View>
      {timeline.events.map((event, index) => (
        <TimelineRow
          key={event.id}
          event={event}
          index={index}
          isLast={index === timeline.events.length - 1}
          onPress={onPressEvent}
        />
      ))}
    </View>
  );
}

function TimelineRow({
  event,
  index,
  isLast,
  onPress,
}: {
  event: TimelineEvent;
  index: number;
  isLast: boolean;
  onPress?: (event: TimelineEvent) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const time = event.at ? format(parseISO(event.at), 'h:mm a') : 'All day';
  const kindLabel = KIND_LABEL[event.kind];
  const canExpand = (event.subtitle?.length ?? 0) > LIKELY_CLAMPED;

  // Expanding a long note happens in place; only entries backed by a work log
  // have somewhere else to go.
  const handlePress = canExpand
    ? () => setExpanded((open) => !open)
    : onPress
      ? () => onPress(event)
      : undefined;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 55).duration(360)}
      style={styles.row}
    >
      <View style={styles.gutter}>
        <Text style={styles.time}>{time}</Text>
      </View>

      <View style={styles.railCol}>
        <View style={[styles.node, { borderColor: event.color }]}>
          <View style={[styles.nodeCore, { backgroundColor: event.color }]} />
        </View>
        {!isLast ? <View style={styles.rail} /> : null}
      </View>

      <CardShell
        onPress={handlePress}
        style={[styles.card, isLast && styles.cardLast]}
      >
        <View style={[styles.accent, { backgroundColor: event.color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHead}>
            <View style={[styles.kindChip, { backgroundColor: event.soft }]}>
              <Feather name={KIND_ICON[event.kind]} size={12} color={event.color} />
            </View>
            <View style={styles.titleCol}>
              {kindLabel ? (
                <Text style={[styles.kindLabel, { color: event.color }]}>{kindLabel}</Text>
              ) : null}
              <Text style={styles.title} numberOfLines={expanded ? undefined : 2}>
                {event.title}
              </Text>
            </View>
            {event.trailing ? (
              <Text style={styles.trailing}>{event.trailing}</Text>
            ) : null}
          </View>
          {event.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={expanded ? undefined : CLAMPED_LINES}>
              {event.subtitle}
            </Text>
          ) : null}
          {canExpand ? (
            <View style={styles.moreRow}>
              <Text style={[styles.moreText, { color: event.color }]}>
                {expanded ? 'Show less' : 'Show more'}
              </Text>
              <Feather
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={event.color}
              />
            </View>
          ) : null}
        </View>
      </CardShell>
    </Animated.View>
  );
}

/** Pressable only when the caller wants tap-through, so static rows stay inert. */
function CardShell({
  onPress,
  style,
  children,
}: {
  onPress?: () => void;
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <AnimatedPressable scaleTo={0.98} onPress={onPress} style={style}>
      {children}
    </AnimatedPressable>
  );
}

const GUTTER_WIDTH = 62;
const RAIL_WIDTH = 22;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  gutter: {
    width: GUTTER_WIDTH,
    paddingTop: 16,
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  time: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: AppTheme.mute,
  },
  railCol: {
    width: RAIL_WIDTH,
    alignItems: 'center',
  },
  node: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    backgroundColor: AppTheme.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 17,
  },
  nodeCore: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  rail: {
    flex: 1,
    width: 2,
    backgroundColor: AppTheme.soft2,
    marginTop: 2,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: AppTheme.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    ...appSoftShadow,
  },
  cardLast: {
    marginBottom: 0,
  },
  accent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    minWidth: 0,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  kindLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 8,
  },
  moreText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
  },
  kindChip: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14.5,
    color: AppTheme.ink,
    letterSpacing: -0.2,
  },
  trailing: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: AppTheme.inkSoft,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: AppTheme.mute,
    lineHeight: 19,
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 42,
    paddingHorizontal: 28,
    backgroundColor: AppTheme.card,
    borderRadius: 20,
    ...appSoftShadow,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: AppTheme.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16.5,
    color: AppTheme.ink,
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    color: AppTheme.mute,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
});
