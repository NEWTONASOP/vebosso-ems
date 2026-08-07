// ============================================================================
// VEBOSSO EMS — Team day list
// One row per team member for a single day, so an owner or manager can see the
// whole team's attendance at a glance before drilling into one person's timeline.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import {
  DAY_STATUS_COLOR,
  DAY_STATUS_LABEL,
  DayStatus,
  getDayStatus,
} from '../lib/attendanceTimeline';
import { AppTheme, appSoftShadow } from '../constants/theme';
import { LeaveRequest, Profile, WorkLogWithProfile } from '../types/database';

export interface TeamDayRow {
  userId: string;
  name: string;
  employeeId: string;
  status: DayStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalHours: number | null;
  /** Ready-to-render summary of the person's day. */
  spanLabel: string;
}

/**
 * An open check-in only means "still working" while the day is in progress.
 * On a past day it means the person never checked out, which is a gap worth
 * naming rather than papering over with a live-sounding "now".
 */
function buildSpanLabel({
  day,
  status,
  checkInTime,
  checkOutTime,
  today,
}: {
  day: string;
  status: DayStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  today: string;
}): string {
  if (!checkInTime) return DAY_STATUS_LABEL[status];

  const inAt = format(parseISO(checkInTime), 'h:mm a');
  if (checkOutTime) return `${inAt} – ${format(parseISO(checkOutTime), 'h:mm a')}`;
  if (day === today) return `Since ${inAt}`;
  return `${inAt} · no check-out`;
}

/**
 * Members with no work log still need a row — "nobody checked in" is exactly
 * the thing an owner opens this view to find out.
 */
export function buildTeamDayRows({
  day,
  members,
  workLogs,
  leaves,
  now = new Date(),
}: {
  /** yyyy-MM-dd the rows describe. */
  day: string;
  members: Profile[];
  workLogs: WorkLogWithProfile[];
  leaves: LeaveRequest[];
  now?: Date;
}): TeamDayRow[] {
  const logByUser = new Map(workLogs.map((log) => [log.user_id, log]));
  const leaveByUser = new Map(leaves.map((leave) => [leave.user_id, leave]));
  const today = format(now, 'yyyy-MM-dd');

  return members
    .map((member) => {
      const log = logByUser.get(member.id) ?? null;
      const leave = leaveByUser.get(member.id) ?? null;
      const status = getDayStatus({ workLog: log, leave });
      const checkInTime = log?.check_in_time ?? null;
      const checkOutTime = log?.check_out_time ?? null;

      return {
        userId: member.id,
        name: member.full_name,
        employeeId: member.employee_id,
        status,
        checkInTime,
        checkOutTime,
        totalHours: log?.total_hours ?? null,
        spanLabel: buildSpanLabel({ day, status, checkInTime, checkOutTime, today }),
      };
    })
    .sort((a, b) => {
      // Surface people who need attention, then those present, then the rest.
      const rank: Record<DayStatus, number> = {
        pending: 0,
        rejected: 1,
        working: 2,
        done: 3,
        leave: 4,
        none: 5,
      };
      const diff = rank[a.status] - rank[b.status];
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
}

interface TeamDayListProps {
  rows: TeamDayRow[];
  onSelectMember?: (userId: string) => void;
}

export function TeamDayList({ rows, onSelectMember }: TeamDayListProps) {
  const summary = useMemo(() => {
    const present = rows.filter(
      (r) => r.status === 'working' || r.status === 'done' || r.status === 'pending'
    ).length;
    const onLeave = rows.filter((r) => r.status === 'leave').length;
    const missing = rows.filter((r) => r.status === 'none').length;
    return { present, onLeave, missing };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Feather name="users" size={20} color={AppTheme.mute} />
        </View>
        <Text style={styles.emptyTitle}>No team members</Text>
        <Text style={styles.emptyBody}>
          Add people to your team to see their attendance here.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.summary}>
        <SummaryStat value={summary.present} label="Present" color={AppTheme.green} />
        <View style={styles.summaryDivider} />
        <SummaryStat value={summary.onLeave} label="On leave" color={AppTheme.violet} />
        <View style={styles.summaryDivider} />
        <SummaryStat value={summary.missing} label="No record" color={AppTheme.mute} />
      </View>

      {rows.map((row, index) => (
        <TeamRow
          key={row.userId}
          row={row}
          index={index}
          onPress={onSelectMember ? () => onSelectMember(row.userId) : undefined}
        />
      ))}
    </View>
  );
}

function SummaryStat({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function TeamRow({
  row,
  index,
  onPress,
}: {
  row: TeamDayRow;
  index: number;
  onPress?: () => void;
}) {
  const statusColor = DAY_STATUS_COLOR[row.status] ?? AppTheme.mute;
  const initials = row.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const content = (
    <>
      <View style={[styles.avatar, { backgroundColor: `${statusColor}1F` }]}>
        <Text style={[styles.avatarText, { color: statusColor }]}>{initials}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {row.spanLabel}
        </Text>
      </View>
      {row.totalHours ? (
        <Text style={styles.rowHours}>{row.totalHours.toFixed(1)}h</Text>
      ) : (
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      )}
    </>
  );

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(320)}>
      {onPress ? (
        <AnimatedPressable scaleTo={0.98} onPress={onPress} style={styles.row}>
          {content}
        </AnimatedPressable>
      ) : (
        <View style={styles.row}>{content}</View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.card,
    borderRadius: 20,
    paddingVertical: 16,
    marginBottom: 14,
    ...appSoftShadow,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
    color: AppTheme.mute,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: AppTheme.hairline,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.card,
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    ...appSoftShadow,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13.5,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: AppTheme.ink,
    letterSpacing: -0.2,
  },
  rowMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: AppTheme.mute,
    marginTop: 3,
  },
  rowHours: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    color: AppTheme.inkSoft,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
