// ============================================================================
// VEBOSSO EMS — Member Card Component
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { StyleSheet, View } from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { ROLE_LABELS, TASK_STATUS_CONFIG, WORK_LOG_STATUS_CONFIG } from '../constants/roles';
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

function getStatusDisplay(status: WorkLogStatus | 'offline' | 'on_leave') {
  if (status === 'offline') {
    return { label: 'Not checked in', color: Colors.textTertiary, bg: Colors.surfaceLight };
  }
  if (status === 'on_leave') {
    return { label: 'On Leave', color: Colors.warning, bg: Colors.warningLight };
  }
  const config = WORK_LOG_STATUS_CONFIG[status];
  return {
    label: config?.label || 'Unknown',
    color: config?.color || Colors.textTertiary,
    bg: config?.backgroundColor || Colors.surfaceLight,
  };
}

function getAvatarColors(role: Profile['role']) {
  switch (role) {
    case 'owner':
      return { bg: Colors.ownerAccent + '15', text: Colors.ownerAccent };
    case 'manager':
      return { bg: Colors.managerAccent + '15', text: Colors.managerAccent };
    default:
      return { bg: Colors.memberAccent + '15', text: Colors.memberAccent };
  }
}

function getRoleMutedColor(role: Profile['role']) {
  switch (role) {
    case 'owner':
      return Colors.ownerAccent;
    case 'manager':
      return Colors.managerAccent;
    default:
      return Colors.memberAccent;
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
    ? Colors.success
    : isWorking
      ? Colors.warning
      : Colors.info;

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
              {onPress && <Feather name="chevron-right" size={16} color={Colors.textTertiary} />}
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
                  <Feather name="log-in" size={10} color={Colors.success} />
                  <Text style={[styles.timeChipText, styles.timeChipTextIn]}>{formattedCheckIn}</Text>
                </View>
              )}
              {formattedCheckOut && (
                <View style={[styles.timeChip, styles.timeChipOut]}>
                  <Feather name="log-out" size={10} color={Colors.textSecondary} />
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
              <View style={[styles.summaryBlock, { backgroundColor: workLabelColor + '0D' }]}>
                <Text style={[styles.footerLabel, { color: workLabelColor }]}>{workLabel}</Text>
                <Text style={styles.footerBody} numberOfLines={2}>
                  {workSummary}
                </Text>
              </View>
            )}

            {hasTaskSummary && (
              <View style={styles.taskSummary}>
                {inProgressTaskCount > 0 && (
                  <View style={[styles.taskPill, { backgroundColor: TASK_STATUS_CONFIG.in_progress.backgroundColor }]}>
                    <Text style={[styles.taskStat, { color: TASK_STATUS_CONFIG.in_progress.color }]}>
                      {inProgressTaskCount} active
                    </Text>
                  </View>
                )}
                {pendingTaskCount > 0 && (
                  <View style={[styles.taskPill, { backgroundColor: TASK_STATUS_CONFIG.pending.backgroundColor }]}>
                    <Text style={[styles.taskStat, { color: TASK_STATUS_CONFIG.pending.color }]}>
                      {pendingTaskCount} pending
                    </Text>
                  </View>
                )}
                {doneTaskCount > 0 && (
                  <View style={[styles.taskPill, { backgroundColor: TASK_STATUS_CONFIG.done.backgroundColor }]}>
                    <Text style={[styles.taskStat, { color: TASK_STATUS_CONFIG.done.color }]}>
                      {doneTaskCount} done
                    </Text>
                  </View>
                )}
              </View>
            )}

            {activeTasks.length > 0 && (
              <View style={styles.taskList}>
                {activeTasks.slice(0, 2).map((task, i) => {
                  const taskColor = TASK_STATUS_CONFIG[task.status]?.color || Colors.textTertiary;
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
    marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
    color: Colors.text,
    letterSpacing: -0.2,
  },
  metaLine: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
  },
  metaSep: {
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  roleText: {
    fontFamily: 'Inter_500Medium',
    opacity: 0.85,
  },
  department: {
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
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
    borderRadius: 10,
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
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  timeChipIn: {
    backgroundColor: Colors.successLight,
    borderColor: 'rgba(4, 120, 87, 0.15)',
  },
  timeChipOut: {
    backgroundColor: Colors.surfaceLight,
    borderColor: Colors.borderLight,
  },
  timeChipText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  timeChipTextIn: {
    color: Colors.success,
  },
  footer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    gap: 6,
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
    color: Colors.text,
    lineHeight: 18,
  },
  footerMuted: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  summaryBlock: {
    gap: 2,
    padding: 10,
    borderRadius: 12,
  },
  taskSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  taskPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
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
    color: Colors.text,
  },
});
