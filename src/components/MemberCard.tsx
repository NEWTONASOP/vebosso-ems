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
  onPress?: (pageY: number) => void;
  index?: number;
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
  const handlePress = (e: any) => {
    if (!onPress) return;
    const pageY = e?.nativeEvent?.pageY ?? 200;
    onPress(pageY);
  };

  const getStatusDisplay = () => {
    if (currentStatus === 'offline') {
      return { label: 'Not checked in', color: Colors.textTertiary, bg: Colors.surfaceLight };
    }
    if (currentStatus === 'on_leave') {
      return { label: 'On Leave', color: Colors.warning, bg: Colors.warningLight };
    }
    const config = WORK_LOG_STATUS_CONFIG[currentStatus as WorkLogStatus];
    return {
      label: config?.label || 'Unknown',
      color: config?.color || Colors.textTertiary,
      bg: config?.backgroundColor || Colors.surfaceLight,
    };
  };

  const getAvatarColors = () => {
    switch (member.role) {
      case 'owner': return { bg: Colors.ownerAccent + '15', text: Colors.ownerAccent };
      case 'manager': return { bg: Colors.managerAccent + '15', text: Colors.managerAccent };
      case 'member': default: return { bg: Colors.memberAccent + '15', text: Colors.memberAccent };
    }
  };

  const status = getStatusDisplay();
  const avatarColors = getAvatarColors();
  const hasWorkLog = currentStatus !== 'offline' && currentStatus !== 'on_leave';
  const isWorking = currentStatus === 'working' || currentStatus === 'pending_approval' || currentStatus === 'pending_checkout';
  const isDone = currentStatus === 'done';

  const formattedCheckIn = checkInTime ? format(new Date(checkInTime), 'hh:mm a') : null;
  const formattedCheckOut = checkOutTime ? format(new Date(checkOutTime), 'hh:mm a') : null;

  const workSummary =
    isDone && dayReport
      ? dayReport
      : checkInPlan || null;

  const workLabel = isDone && dayReport ? 'Worked today' : isWorking ? 'Working on' : checkInPlan ? 'Plan' : null;

  const openTaskTotal = pendingTaskCount + inProgressTaskCount;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      layout={LinearTransition.springify()}
      style={styles.cardContainer}
    >
      <AnimatedPressable style={styles.card} onPress={handlePress}>
        <View style={styles.topRow}>
          <Avatar.Text
            size={44}
            label={member.full_name.substring(0, 2).toUpperCase()}
            style={[styles.avatar, { backgroundColor: avatarColors.bg }]}
            labelStyle={[styles.avatarLabel, { color: avatarColors.text }]}
          />

          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{member.full_name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>

            <Text style={styles.details}>
              {member.employee_id}
              {member.department ? ` • ${member.department}` : ''}
              {' • '}
              {ROLE_LABELS[member.role]}
            </Text>

            {(formattedCheckIn || formattedCheckOut) && (
              <View style={styles.activityRow}>
                {formattedCheckIn && (
                  <View style={styles.activityChip}>
                    <Feather name="log-in" size={11} color={Colors.success} />
                    <Text style={styles.activityChipText}>In {formattedCheckIn}</Text>
                  </View>
                )}
                {formattedCheckOut && (
                  <View style={styles.activityChip}>
                    <Feather name="log-out" size={11} color={Colors.textSecondary} />
                    <Text style={styles.activityChipText}>Out {formattedCheckOut}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Today's work summary — visible without opening card */}
        {workSummary && workLabel && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{workLabel}</Text>
            <Text style={styles.sectionBody} numberOfLines={2}>
              {workSummary}
            </Text>
          </View>
        )}

        {currentStatus === 'on_leave' && (
          <View style={styles.section}>
            <Text style={styles.sectionBodyMuted}>Away on approved leave today</Text>
          </View>
        )}

        {!hasWorkLog && currentStatus === 'offline' && openTaskTotal === 0 && doneTaskCount === 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionBodyMuted}>No attendance logged today</Text>
          </View>
        )}

        {/* Tasks snapshot */}
        {(openTaskTotal > 0 || doneTaskCount > 0 || activeTasks.length > 0) && (
          <View style={styles.section}>
            <View style={styles.taskCountsRow}>
              <Text style={styles.sectionLabel}>Tasks</Text>
              <View style={styles.activityRow}>
                {inProgressTaskCount > 0 && (
                  <View style={styles.activityChip}>
                    <Feather name="play-circle" size={11} color={TASK_STATUS_CONFIG.in_progress.color} />
                    <Text style={styles.activityChipText}>{inProgressTaskCount} active</Text>
                  </View>
                )}
                {pendingTaskCount > 0 && (
                  <View style={styles.activityChip}>
                    <Feather name="circle" size={11} color={TASK_STATUS_CONFIG.pending.color} />
                    <Text style={styles.activityChipText}>{pendingTaskCount} pending</Text>
                  </View>
                )}
                {doneTaskCount > 0 && (
                  <View style={styles.activityChip}>
                    <Feather name="check-circle" size={11} color={TASK_STATUS_CONFIG.done.color} />
                    <Text style={styles.activityChipText}>{doneTaskCount} done</Text>
                  </View>
                )}
              </View>
            </View>

            {activeTasks.slice(0, 3).map((task, i) => {
              const taskColor = TASK_STATUS_CONFIG[task.status]?.color || Colors.textTertiary;
              return (
                <View key={`${task.title}-${i}`} style={styles.taskRow}>
                  <View style={[styles.taskDot, { backgroundColor: taskColor }]} />
                  <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                </View>
              );
            })}
          </View>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {},
  avatarLabel: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    flexShrink: 1,
  },
  details: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activityRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  activityChipText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
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
    fontFamily: 'Inter_600SemiBold',
  },
  section: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  sectionBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    lineHeight: 18,
  },
  sectionBodyMuted: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  taskCountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  taskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  taskTitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
});
