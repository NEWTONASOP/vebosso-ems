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

function getRolePillColor(role: Profile['role']) {
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
  const roleColor = getRolePillColor(member.role);

  const isWorking =
    currentStatus === 'working' ||
    currentStatus === 'pending_approval' ||
    currentStatus === 'pending_checkout';
  const isDone = currentStatus === 'done';

  const formattedCheckIn = checkInTime ? format(new Date(checkInTime), 'hh:mm a') : null;
  const formattedCheckOut = checkOutTime ? format(new Date(checkOutTime), 'hh:mm a') : null;

  const workSummary = isDone && dayReport ? dayReport : checkInPlan || null;
  const workLabel = isDone && dayReport ? 'Worked today' : isWorking ? 'Working on' : checkInPlan ? 'Plan' : null;

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

            <View style={styles.metaRow}>
              <Text style={styles.employeeId}>{member.employee_id}</Text>
              <View style={[styles.rolePill, { backgroundColor: roleColor }]}>
                <Text style={styles.rolePillText}>{ROLE_LABELS[member.role]}</Text>
              </View>
            </View>

            {!!member.department && (
              <Text style={styles.department} numberOfLines={1}>
                {member.department}
              </Text>
            )}

            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
              </View>
              {formattedCheckIn && (
                <View style={styles.timeChip}>
                  <Feather name="log-in" size={10} color={Colors.success} />
                  <Text style={styles.timeChipText}>{formattedCheckIn}</Text>
                </View>
              )}
              {formattedCheckOut && (
                <View style={styles.timeChip}>
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
              <View style={styles.summaryBlock}>
                <Text style={styles.footerLabel}>{workLabel}</Text>
                <Text style={styles.footerBody} numberOfLines={2}>
                  {workSummary}
                </Text>
              </View>
            )}

            {hasTaskSummary && (
              <View style={styles.taskSummary}>
                {inProgressTaskCount > 0 && (
                  <Text style={[styles.taskStat, { color: TASK_STATUS_CONFIG.in_progress.color }]}>
                    {inProgressTaskCount} active
                  </Text>
                )}
                {pendingTaskCount > 0 && (
                  <Text style={[styles.taskStat, { color: TASK_STATUS_CONFIG.pending.color }]}>
                    {pendingTaskCount} pending
                  </Text>
                )}
                {doneTaskCount > 0 && (
                  <Text style={[styles.taskStat, { color: TASK_STATUS_CONFIG.done.color }]}>
                    {doneTaskCount} done
                  </Text>
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  employeeId: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  rolePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  rolePillText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
  },
  department: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  timeChipText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
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
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginBottom: 1,
  },
  footerBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
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
  },
  taskSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    color: Colors.textSecondary,
  },
});
