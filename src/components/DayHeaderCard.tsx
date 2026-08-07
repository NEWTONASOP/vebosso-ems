// ============================================================================
// VEBOSSO EMS — Day header card
// The selected day's summary plus the actions that apply to it. Actions live
// next to the day they act on, so nothing depends on the user first entering a
// mode and then hunting for the right date to tap.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AnimatedPressable } from './AnimatedPressable';
import { DAY_STATUS_COLOR, DAY_STATUS_LABEL, DayStatus } from '../lib/attendanceTimeline';
import { AppTheme, appSoftShadow } from '../constants/theme';

export interface DayAction {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  disabled?: boolean;
  /** `primary` is the expected next step; `warn` is an administrative override. */
  tone?: 'primary' | 'neutral' | 'warn';
}

interface DayHeaderCardProps {
  date: Date;
  status: DayStatus;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  totalHours?: number | null;
  actions?: DayAction[];
  /** Shown under the actions, e.g. to confirm an override took effect. */
  note?: string | null;
}

function timeOf(iso?: string | null): string | null {
  return iso ? format(new Date(iso), 'h:mm a') : null;
}

export function DayHeaderCard({
  date,
  status,
  checkInTime,
  checkOutTime,
  totalHours,
  actions = [],
  note,
}: DayHeaderCardProps) {
  const statusColor = DAY_STATUS_COLOR[status] ?? AppTheme.mute;
  const inAt = timeOf(checkInTime);
  const outAt = timeOf(checkOutTime);

  const summary = inAt
    ? `${inAt} – ${outAt ?? 'no check-out'}${totalHours ? ` · ${totalHours.toFixed(1)}h` : ''}`
    : DAY_STATUS_LABEL[status];

  const visibleActions = actions.filter(Boolean);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.title}>{format(date, 'EEEE, d MMMM')}</Text>
          <Text style={styles.summary} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}1F` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {DAY_STATUS_LABEL[status]}
          </Text>
        </View>
      </View>

      {visibleActions.length > 0 ? (
        <View style={styles.actions}>
          {visibleActions.map((action) => {
            const tone = action.tone ?? 'neutral';
            const disabled = !!action.disabled;
            const fg =
              disabled
                ? AppTheme.mute
                : tone === 'primary'
                  ? AppTheme.white
                  : tone === 'warn'
                    ? AppTheme.amber
                    : AppTheme.ink;

            return (
              <AnimatedPressable
                key={action.key}
                scaleTo={0.97}
                onPress={action.onPress}
                disabled={disabled}
                style={[
                  styles.action,
                  tone === 'primary' && !disabled && styles.actionPrimary,
                  tone === 'warn' && !disabled && styles.actionWarn,
                  disabled && styles.actionDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityState={{ disabled }}
              >
                <Feather name={action.icon} size={15} color={fg} />
                <Text style={[styles.actionText, { color: fg }]} numberOfLines={1}>
                  {action.label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      ) : null}

      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    ...appSoftShadow,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: AppTheme.ink,
    letterSpacing: -0.4,
  },
  summary: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: AppTheme.mute,
    marginTop: 2,
  },
  statusPill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11.5,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 42,
    borderRadius: 13,
    backgroundColor: AppTheme.soft,
    paddingHorizontal: 12,
  },
  actionPrimary: {
    backgroundColor: AppTheme.charcoal,
  },
  actionWarn: {
    backgroundColor: AppTheme.amberSoft,
  },
  actionDisabled: {
    backgroundColor: AppTheme.soft,
    opacity: 0.6,
  },
  actionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
  },
  note: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: AppTheme.mute,
    marginTop: 10,
    lineHeight: 18,
  },
});
