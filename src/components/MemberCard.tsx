// ============================================================================
// VEBOSSO EMS — Member Card Component
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { StyleSheet, View } from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { AppTheme, appSoftShadow } from '../constants/theme';
import { ROLE_LABELS, WORK_LOG_STATUS_CONFIG } from '../constants/roles';
import { Profile, WorkLogStatus } from '../types/database';
import { AnimatedPressable } from './AnimatedPressable';

export type MemberActiveTask = {
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done';
};

interface MemberCardProps {
  member: Profile;
  currentStatus?: WorkLogStatus | 'offline' | 'on_leave';
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkInPlan?: string | null;
  dayReport?: string | null;
  pendingTaskCount?: number;
  inProgressTaskCount?: number;
  doneTaskCount?: number;
  activeTasks?: MemberActiveTask[];
  onPress?: () => void;
  index?: number;
}

const TASK_CHIP = {
  pending: { color: AppTheme.amber, bg: AppTheme.amberSoft },
  in_progress: { color: AppTheme.blue, bg: AppTheme.blueSoft },
  done: { color: AppTheme.green, bg: AppTheme.greenSoft },
} as const;

function getStatusDisplay(status: WorkLogStatus | 'offline' | 'on_leave') {
  if (status === 'offline') {
    return { label: 'Not checked in', color: AppTheme.mute, bg: AppTheme.soft };
  }
  if (status === 'on_leave') {
    return { label: 'On Leave', color: AppTheme.amber, bg: AppTheme.amberSoft };
  }
  const config = WORK_LOG_STATUS_CONFIG[status];
  const statusTheme: Record<string, { color: string; bg: string }> = {
    pending_approval: { color: AppTheme.amber, bg: AppTheme.amberSoft },
    working: { color: AppTheme.green, bg: AppTheme.greenSoft },
    pending_checkout: { color: AppTheme.violet, bg: AppTheme.violetSoft },
    done: { color: AppTheme.inkSoft, bg: AppTheme.soft },
    rejected: { color: AppTheme.coral, bg: AppTheme.coralSoft },
  };
  const theme = statusTheme[status];
  return {
    label: config?.label || 'Unknown',
    color: theme?.color || AppTheme.mute,
    bg: theme?.bg || AppTheme.soft,
  };
}

function getAvatarColors(role: Profile['role']) {
  switch (role) {
    case 'owner':
      return { bg: AppTheme.violetSoft, text: AppTheme.violet };
    case 'manager':
      return { bg: AppTheme.blueSoft, text: AppTheme.blue };
    default:
      return { bg: AppTheme.greenSoft, text: AppTheme.green };
  }
}

function getRoleMutedColor(role: Profile['role']) {
  switch (role) {
    case 'owner':
      return AppTheme.violet;
    case 'manager':
      return AppTheme.blue;
    default:
      return AppTheme.green;
  }
}

export function MemberCard({
  member,
  currentStatus = 'offline',
  checkInTime,
  checkOutTime,
  checkInPlan,
  dayReport,
  pendingTaskCount = 0,
  inProgressTaskCount = 0,
  doneTaskCount = 0,
  activeTasks = [],
  onPress,
  index = 0,
}: MemberCardProps) {
  const status = getStatusDisplay(currentStatus);
  const avatarColors = getAvatarColors(member.role);
  const roleMuted = getRoleMutedColor(member.role);

  const isWorking =
    currentStatus === 'working' ||
    currentStatus === 'pending_approval' ||
    currentStatus === 'pending_checkout';
  const isDone = currentStatus === 'done';

  const formattedCheckIn = checkInTime ? format(new Date(checkInTime), 'hh:mm a') : null;
  const formattedCheckOut = checkOutTime ? format(new Date(checkOutTime), 'hh:mm a') : null;

  const workSummary = isDone && dayReport ? dayReport : checkInPlan || null;
  const workLabel = isDone && dayReport ? 'Worked today' : isWorking ? 'Working on' : checkInPlan ? 'Plan' : null;
  const workLabelColor = isDone
    ? AppTheme.green
    : isWorking
      ? AppTheme.amber
      : AppTheme.blue;
  const workLabelBg = isDone
    ? AppTheme.greenSoft
    : isWorking
      ? AppTheme.amberSoft
      : AppTheme.blueSoft;

  const openTaskTotal = pendingTaskCount + inProgressTaskCount;
  const hasTaskSummary = openTaskTotal > 0 || doneTaskCount > 0;
  const hasFooter = !!(workSummary && workLabel) || hasTaskSummary || currentStatus === 'on_leave';

  const CardWrapper = onPress ? AnimatedPressable : View;
  const cardProps = onPress ? { onPress, style: styles.card } : { style: styles.card };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).springify()}
      layout={LinearTransition.springify()}
      style={styles.cardContainer}
    >
      <CardWrapper {...cardProps}>
        <View style={styles.topRow}>
          <Avatar.Text
            size={40}
            label={member.full_name.substring(0, 2).toUpperCase()}
            style={{ backgroundColor: avatarColors.bg }}
            labelStyle={{ color: avatarColors.text, fontFamily: 'Inter_700Bold', fontSize: 14 }}
          />

          <View style={styles.info}>
            <View style={styles.titleRow}>
              <Text style={styles.name} numberOfLines={1}>
                {member.full_name}
              </Text>
              {onPress && <Feather name="chevron-right" size={16} color={AppTheme.mute} />}
            </View>

            <Text style={styles.metaLine} numberOfLines={1}>
              <Text style={[styles.roleText, { color: roleMuted }]}>
                {ROLE_LABELS[member.role] ?? member.role}
              </Text>
              {!!member.department && (
                <>
                  <Text style={styles.metaSep}> · </Text>
                  <Text style={styles.department}>{member.department}</Text>
                </>
              )}
            </Text>

            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
              </View>
              {formattedCheckIn && (
                <View style={[styles.timeChip, styles.timeChipIn]}>
                  <Feather name="log-in" size={10} color={AppTheme.green} />
                  <Text style={[styles.timeChipText, styles.timeChipTextIn]}>{formattedCheckIn}</Text>
                </View>
              )}
              {formattedCheckOut && (
                <View style={[styles.timeChip, styles.timeChipOut]}>
                  <Feather name="log-out" size={10} color={AppTheme.mute} />
                  <Text style={styles.timeChipText}>{formattedCheckOut}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {hasFooter && (
          <View style={styles.footer}>
            {currentStatus === 'on_leave' && (
              <Text style={styles.footerMuted}>On approved leave today</Text>
            )}

            {workSummary && workLabel && (
              <View style={[styles.summaryBlock, { backgroundColor: workLabelBg }]}>
                <Text style={[styles.footerLabel, { color: workLabelColor }]}>{workLabel}</Text>
                <Text style={styles.footerBody} numberOfLines={2}>
                  {workSummary}
                </Text>
              </View>
            )}

            {hasTaskSummary && (
              <View style={styles.taskSummary}>
                {inProgressTaskCount > 0 && (
                  <View style={[styles.taskPill, { backgroundColor: TASK_CHIP.in_progress.bg }]}>
                    <Text style={[styles.taskStat, { color: TASK_CHIP.in_progress.color }]}>
                      {inProgressTaskCount} active
                    </Text>
                  </View>
                )}
                {pendingTaskCount > 0 && (
                  <View style={[styles.taskPill, { backgroundColor: TASK_CHIP.pending.bg }]}>
                    <Text style={[styles.taskStat, { color: TASK_CHIP.pending.color }]}>
                      {pendingTaskCount} pending
                    </Text>
                  </View>
                )}
                {doneTaskCount > 0 && (
                  <View style={[styles.taskPill, { backgroundColor: TASK_CHIP.done.bg }]}>
                    <Text style={[styles.taskStat, { color: TASK_CHIP.done.color }]}>
                      {doneTaskCount} done
                    </Text>
                  </View>
                )}
              </View>
            )}

            {activeTasks.length > 0 && (
              <View style={styles.taskList}>
                {activeTasks.slice(0, 2).map((task, i) => {
                  const taskColor = TASK_CHIP[task.status]?.color || AppTheme.mute;
                  return (
                    <View key={`${task.title}-${i}`} style={styles.taskRow}>
                      <View style={[styles.taskDot, { backgroundColor: taskColor }]} />
                      <Text style={styles.taskTitle} numberOfLines={1}>
                        {task.title}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </CardWrapper>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 10,
  },
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: 22,
    padding: 14,
    ...appSoftShadow,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: AppTheme.ink,
    letterSpacing: -0.2,
  },
  metaLine: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
  },
  metaSep: {
    fontFamily: 'Inter_400Regular',
    color: AppTheme.mute,
  },
  roleText: {
    fontFamily: 'Inter_500Medium',
    opacity: 0.9,
  },
  department: {
    fontFamily: 'Inter_400Regular',
    color: AppTheme.mute,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  timeChipIn: {
    backgroundColor: AppTheme.greenSoft,
  },
  timeChipOut: {
    backgroundColor: AppTheme.soft,
  },
  timeChipText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.mute,
  },
  timeChipTextIn: {
    color: AppTheme.green,
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppTheme.hairline,
    gap: 8,
  },
  footerLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginBottom: 2,
  },
  footerBody: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: AppTheme.ink,
    lineHeight: 18,
  },
  footerMuted: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: AppTheme.mute,
  },
  summaryBlock: {
    gap: 2,
    padding: 12,
    borderRadius: 14,
  },
  taskSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  taskPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  taskStat: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  taskList: {
    gap: 4,
    marginTop: 2,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  taskTitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: AppTheme.ink,
  },
});
