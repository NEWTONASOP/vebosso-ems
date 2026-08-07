// ============================================================================
// VEBOSSO EMS — Date rail
// A horizontally scrollable strip of every day in one month, with a status dot
// under each day. Jumping to another month goes through the month picker
// rather than a long scroll.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import {
  format,
  getDaysInMonth,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
} from 'date-fns';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { MonthYearPickerModal } from './MonthYearPickerModal';
import { DAY_STATUS_COLOR, DayStatus } from '../lib/attendanceTimeline';
import { AppTheme, appSoftShadow } from '../constants/theme';

const ITEM_WIDTH = 54;
/** Fallback side inset before the list has been measured. */
const EDGE_PAD = 8;

interface DateRailProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  /** Any date inside the month the rail is showing. */
  visibleMonth: Date;
  onChangeMonth: (month: Date) => void;
  /** Status dot under each day. */
  getDayStatus: (date: Date) => DayStatus;
  /** Role accent, used to mark today when it isn't the selected day. */
  accentColor?: string;
}

export function DateRail({
  selectedDate,
  onSelectDate,
  visibleMonth,
  onChangeMonth,
  getDayStatus,
  accentColor = AppTheme.blue,
}: DateRailProps) {
  const listRef = useRef<FlatList<Date>>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  // Centering needs the viewport width. Until onLayout fires we keep a small
  // edge pad and don't attempt to scroll — otherwise the selected day lands
  // flush left on first paint (common on web).
  const [railWidth, setRailWidth] = useState(0);
  const hasCenteredOnce = useRef(false);
  const lastCenteredKey = useRef('');

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    return Array.from(
      { length: getDaysInMonth(visibleMonth) },
      (_, i) => new Date(year, month, i + 1)
    );
  }, [visibleMonth]);

  // Opening a past month should land on a day with data, not on the 1st.
  const anchorIndex = useMemo(() => {
    if (isSameMonth(selectedDate, visibleMonth)) return selectedDate.getDate() - 1;
    if (isSameMonth(new Date(), visibleMonth)) return new Date().getDate() - 1;
    return days.length - 1;
  }, [selectedDate, visibleMonth, days.length]);

  // Side padding large enough that the first and last day can sit in the
  // middle of the viewport, same as any other day.
  const sidePad = railWidth > 0 ? Math.max(EDGE_PAD, (railWidth - ITEM_WIDTH) / 2) : EDGE_PAD;

  const centerOffset = useCallback(
    (index: number) => {
      // With equal side padding, scrolling to index * ITEM_WIDTH puts that
      // cell's left edge at the left pad — which is the viewport centre.
      return Math.max(0, index * ITEM_WIDTH);
    },
    []
  );

  const scrollToAnchor = useCallback(
    (animated: boolean) => {
      if (railWidth <= 0) return;
      const index = Math.min(Math.max(anchorIndex, 0), Math.max(days.length - 1, 0));
      listRef.current?.scrollToOffset({
        offset: centerOffset(index),
        animated,
      });
    },
    [anchorIndex, centerOffset, days.length, railWidth]
  );

  useEffect(() => {
    if (railWidth <= 0) return;

    const key = `${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}-${anchorIndex}`;
    const isFirst = !hasCenteredOnce.current;
    const monthOrDayChanged = lastCenteredKey.current !== key;

    if (!isFirst && !monthOrDayChanged) return;

    lastCenteredKey.current = key;
    hasCenteredOnce.current = true;

    // First paint: jump without animation so the selected day isn't seen
    // sliding in from the left. Later changes animate.
    const frame = requestAnimationFrame(() => {
      scrollToAnchor(!isFirst);
    });
    return () => cancelAnimationFrame(frame);
  }, [railWidth, anchorIndex, visibleMonth, scrollToAnchor]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - railWidth) > 1) {
      setRailWidth(width);
    }
  };

  const handlePickMonth = (month: Date) => {
    onChangeMonth(month);
    // Selecting a month shouldn't strand the timeline on a day from the old
    // one, so move to a sensible day: today if the month is the current one,
    // otherwise its last day.
    const now = new Date();
    onSelectDate(
      isSameMonth(month, now)
        ? startOfDay(now)
        : new Date(month.getFullYear(), month.getMonth(), getDaysInMonth(month))
    );
  };

  const renderDay = ({ item: day }: { item: Date }) => {
    const selected = isSameDay(day, selectedDate);
    const today = isToday(day);
    const dotColor = DAY_STATUS_COLOR[getDayStatus(day)];

    return (
      <AnimatedPressable
        scaleTo={0.94}
        onPress={() => onSelectDate(day)}
        style={styles.cell}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={format(day, 'EEEE d MMMM yyyy')}
      >
        <Text style={[styles.weekday, selected && styles.weekdaySelected]}>
          {format(day, 'EEE')}
        </Text>
        <View style={[styles.pill, selected && styles.pillSelected]}>
          <Text
            style={[
              styles.dayNum,
              today && !selected && { color: accentColor },
              selected && styles.dayNumSelected,
            ]}
          >
            {format(day, 'd')}
          </Text>
        </View>
        <View style={styles.dotSlot}>
          {dotColor ? (
            <Animated.View
              entering={FadeIn.duration(220)}
              style={[styles.dot, { backgroundColor: selected ? AppTheme.white : dotColor }]}
            />
          ) : null}
        </View>
      </AnimatedPressable>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <AnimatedPressable
          scaleTo={0.96}
          onPress={() => setPickerVisible(true)}
          style={styles.monthBtn}
          accessibilityRole="button"
          accessibilityLabel={`${format(visibleMonth, 'MMMM yyyy')}, change month`}
        >
          <Text style={styles.month}>{format(visibleMonth, 'MMMM yyyy')}</Text>
          <Feather name="chevron-down" size={16} color={AppTheme.inkSoft} />
        </AnimatedPressable>

        {!isToday(selectedDate) ? (
          <AnimatedPressable
            scaleTo={0.94}
            onPress={() => {
              const now = startOfDay(new Date());
              if (!isSameMonth(now, visibleMonth)) onChangeMonth(now);
              onSelectDate(now);
            }}
            style={styles.todayBtn}
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
          >
            <Feather name="corner-up-left" size={13} color={AppTheme.inkSoft} />
            <Text style={styles.todayText}>Today</Text>
          </AnimatedPressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={days}
        renderItem={renderDay}
        keyExtractor={(day) => day.toISOString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
        disableIntervalMomentum
        onLayout={handleLayout}
        getItemLayout={(_, index) => ({
          length: ITEM_WIDTH,
          offset: ITEM_WIDTH * index,
          index,
        })}
        // If a scroll races layout, retry once the list is ready — still
        // centered, never flush-left.
        onScrollToIndexFailed={({ index }) => {
          requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({
              offset: centerOffset(index),
              animated: false,
            });
          });
        }}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: sidePad }]}
      />

      <MonthYearPickerModal
        visible={pickerVisible}
        onDismiss={() => setPickerVisible(false)}
        value={visibleMonth}
        onSelect={handlePickMonth}
        accentColor={accentColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: AppTheme.card,
    borderRadius: 22,
    paddingTop: 14,
    paddingBottom: 10,
    ...appSoftShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  monthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  month: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: AppTheme.ink,
    letterSpacing: -0.3,
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: AppTheme.soft,
  },
  todayText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: AppTheme.inkSoft,
  },
  listContent: {
    // paddingHorizontal is set dynamically so the selected day can sit dead
    // centre even when it's the 1st or last of the month.
  },
  cell: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  weekday: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11.5,
    color: AppTheme.mute,
  },
  weekdaySelected: {
    color: AppTheme.inkSoft,
  },
  pill: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: AppTheme.charcoal,
  },
  dayNum: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: AppTheme.ink,
  },
  dayNumSelected: {
    fontFamily: 'Inter_700Bold',
    color: AppTheme.white,
  },
  // Fixed height so rows don't shift when a day has no status dot.
  dotSlot: {
    height: 6,
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
