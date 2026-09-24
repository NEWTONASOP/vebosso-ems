// ============================================================================
// VEBOSSO EMS — Date & time fields
// One way to pick a date or a time everywhere in the app: quick chips for the
// common answers (Today, Yesterday…) and a calendar / clock for anything else.
// Nobody types dates.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, isToday, isYesterday, parseISO, startOfDay } from 'date-fns';
import { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { DatePickerModal, enGB, registerTranslation, TimePickerModal } from 'react-native-paper-dates';
import { AppTheme as T } from '../constants/theme';

registerTranslation('en-GB', enGB);

const KEY = (d: Date) => format(d, 'yyyy-MM-dd');

export interface QuickDate {
  label: string;
  /** "yyyy-MM-dd" */
  value: string;
}

/**
 * A date as quick chips plus a calendar.
 * @param value "yyyy-MM-dd" or null
 * @param allow 'past' = today or earlier, 'future' = today or later.
 */
export function DateField({
  label,
  value,
  onChange,
  quick = [],
  allow = 'any',
  placeholder = 'Pick a date',
  disabled,
  style,
}: {
  label?: string;
  value: string | null;
  onChange: (value: string) => void;
  quick?: QuickDate[];
  allow?: 'past' | 'future' | 'any';
  placeholder?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const isQuick = !!value && quick.some((q) => q.value === value);
  const today = startOfDay(new Date());

  const picked = value && !isQuick ? parseISO(value) : null;
  const pickedLabel = picked
    ? isToday(picked)
      ? 'Today'
      : isYesterday(picked)
        ? 'Yesterday'
        : format(picked, 'EEE, d MMM yyyy')
    : null;

  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {quick.map((q) => {
          const active = value === q.value;
          return (
            <Pressable
              key={q.value}
              onPress={() => !disabled && onChange(q.value)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{q.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => !disabled && setOpen(true)}
          style={[styles.chip, styles.pickChip, !!picked && styles.chipActive]}
          accessibilityRole="button"
          accessibilityLabel={pickedLabel ? `Date ${pickedLabel}, change` : placeholder}
        >
          <Feather name="calendar" size={14} color={picked ? T.white : T.inkSoft} />
          <Text style={[styles.chipText, !!picked && styles.chipTextActive]} numberOfLines={1}>
            {pickedLabel ?? (quick.length ? 'Other date' : placeholder)}
          </Text>
        </Pressable>
      </View>

      <DatePickerModal
        locale="en-GB"
        mode="single"
        visible={open}
        date={value ? parseISO(value) : undefined}
        validRange={
          allow === 'past' ? { endDate: today } : allow === 'future' ? { startDate: today } : undefined
        }
        onDismiss={() => setOpen(false)}
        onConfirm={({ date }) => {
          setOpen(false);
          if (date) onChange(KEY(date));
        }}
        label={label}
        saveLabel="Done"
      />
    </View>
  );
}

/** A time of day. @param value "HH:mm" (24h) or null */
export function TimeField({
  label,
  value,
  onChange,
  placeholder = 'Pick a time',
  disabled,
  style,
}: {
  label?: string;
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const [h, m] = (value ?? '').split(':').map(Number);
  const has = Number.isFinite(h) && Number.isFinite(m);
  const shown = has ? format(new Date(2000, 0, 1, h, m), 'h:mm a') : null;

  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[styles.timeBox]}
        accessibilityRole="button"
        accessibilityLabel={shown ? `${label ?? 'Time'} ${shown}, change` : placeholder}
      >
        <Feather name="clock" size={15} color={T.inkSoft} />
        <Text style={[styles.timeText, !shown && styles.placeholder]}>{shown ?? placeholder}</Text>
      </Pressable>
      <TimePickerModal
        locale="en-GB"
        visible={open}
        label={label}
        hours={has ? h : 9}
        minutes={has ? m : 0}
        use24HourClock={false}
        onDismiss={() => setOpen(false)}
        onConfirm={({ hours, minutes }) => {
          setOpen(false);
          onChange(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
        }}
        confirmLabel="Done"
        cancelLabel="Cancel"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 10 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: T.soft,
    justifyContent: 'center',
  },
  pickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  chipActive: { backgroundColor: T.charcoal },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  chipTextActive: { color: T.white },
  timeBox: {
    height: 46,
    borderRadius: 14,
    backgroundColor: T.soft,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: T.ink },
  placeholder: { color: T.mute },
});
