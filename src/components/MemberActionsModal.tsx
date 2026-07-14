// ============================================================================
// VEBOSSO EMS — Member Actions Modal (Owner Team)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Modal, Portal, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { ROLE_LABELS, TASK_STATUS_CONFIG, WORK_LOG_STATUS_CONFIG } from '../constants/roles';
import { Profile, WorkLogStatus } from '../types/database';
import { MemberActiveTask } from './MemberCard';

interface MemberActionsModalProps {
  visible: boolean;
  member: Profile | null;
  onDismiss: () => void;
  onAssignTask: () => void;
  onAssignManager: () => void;
  onManageProfile: () => void;
  currentStatus?: WorkLogStatus | 'offline' | 'on_leave';
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkInPlan?: string | null;
  dayReport?: string | null;
  pendingTaskCount?: number;
  inProgressTaskCount?: number;
  doneTaskCount?: number;
  activeTasks?: MemberActiveTask[];
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

export function MemberActionsModal({
  visible,
  member,
  onDismiss,
  onAssignTask,
  onAssignManager,
  onManageProfile,
  currentStatus = 'offline',
  checkInTime,
  checkOutTime,
  checkInPlan,
  dayReport,
  pendingTaskCount = 0,
  inProgressTaskCount = 0,
  doneTaskCount = 0,
  activeTasks = [],
}: MemberActionsModalProps) {
  if (!visible || !member) return null;

  const status = getStatusDisplay(currentStatus);
  const avatarColors = getAvatarColors(member.role);
  const roleMuted = getRoleMutedColor(member.role);
  const isWorking =
    currentStatus === 'working' ||
    currentStatus === 'pending_approval' ||
    currentStatus === 'pending_checkout';
  const isDone = currentStatus === 'done';
  const workSummary = isDone && dayReport ? dayReport : checkInPlan || null;
  const workLabel = isDone && dayReport ? 'Worked today' : isWorking ? 'Working on' : checkInPlan ? 'Plan' : null;
  const workLabelColor = isDone
    ? Colors.success
    : isWorking
      ? Colors.warning
      : Colors.info;
  const openTaskTotal = pendingTaskCount + inProgressTaskCount;

  const formattedCheckIn = checkInTime ? format(new Date(checkInTime), 'hh:mm a') : null;
  const formattedCheckOut = checkOutTime ? format(new Date(checkOutTime), 'hh:mm a') : null;

  const runAction = (action: () => void) => {
    action();
  };

  return (
    <Portal>
      <Modal visible onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Avatar.Text
              size={64}
              label={member.full_name.substring(0, 2).toUpperCase()}
              style={{ backgroundColor: avatarColors.bg }}
              labelStyle={{ color: avatarColors.text, fontFamily: 'Inter_700Bold', fontSize: 22 }}
            />
            <Text style={styles.name}>{member.full_name}</Text>
            <Text style={styles.metaLine}>
              <Text style={styles.employeeId}>{member.employee_id}</Text>
              <Text style={styles.metaSep}> · </Text>
              <Text style={[styles.roleText, { color: roleMuted }]}>{ROLE_LABELS[member.role]}</Text>
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
                  <Feather name="log-in" size={11} color={Colors.success} />
                  <Text style={[styles.timeChipText, styles.timeChipTextIn]}>{formattedCheckIn}</Text>
                </View>
              )}
              {formattedCheckOut && (
                <View style={[styles.timeChip, styles.timeChipOut]}>
                  <Feather name="log-out" size={11} color={Colors.textSecondary} />
                  <Text style={styles.timeChipText}>{formattedCheckOut}</Text>
                </View>
              )}
            </View>
          </View>

          {(formattedCheckIn || formattedCheckOut || workSummary || openTaskTotal > 0 || doneTaskCount > 0 || currentStatus === 'on_leave') && (
            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>Today</Text>

              {currentStatus === 'on_leave' && (
                <Text style={styles.footerMuted}>On approved leave today</Text>
              )}

              {workSummary && workLabel && (
                <View style={[styles.summaryBlock, { backgroundColor: workLabelColor + '0D' }]}>
                  <Text style={[styles.summaryLabel, { color: workLabelColor }]}>{workLabel}</Text>
                  <Text style={styles.summaryBody}>{workSummary}</Text>
                </View>
              )}

              {(openTaskTotal > 0 || doneTaskCount > 0) && (
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

              {activeTasks.slice(0, 3).map((task, index) => {
                const taskColor = TASK_STATUS_CONFIG[task.status]?.color || Colors.textTertiary;
                return (
                  <View key={`${task.title}-${index}`} style={styles.taskItem}>
                    <View style={styles.taskRow}>
                      <View style={[styles.taskDot, { backgroundColor: taskColor }]} />
                      <Text style={styles.taskLine} numberOfLines={1}>
                        {task.title}
                      </Text>
                    </View>
                    {!!task.description && (
                      <Text style={styles.taskDesc}>
                        {task.description}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsCard}>
            <ActionRow label="Assign Task" icon="clipboard" onPress={() => runAction(onAssignTask)} />
            {member.role === 'member' && (
              <ActionRow label="Assign Manager" icon="users" onPress={() => runAction(onAssignManager)} />
            )}
            <ActionRow label="Manage Profile" icon="settings" onPress={() => runAction(onManageProfile)} isLast />
          </View>
        </ScrollView>

        <View style={styles.cancelSection}>
          <Button
            mode="outlined"
            onPress={onDismiss}
            style={styles.cancelButton}
            contentStyle={styles.cancelButtonContent}
            textColor={Colors.textSecondary}
          >
            Cancel
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

function ActionRow({
  label,
  icon,
  onPress,
  isLast,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed, isLast && styles.actionRowLast]}
      onPress={onPress}
    >
      <Feather name={icon} size={16} color={Colors.textSecondary} />
      <Text style={styles.actionLabel}>{label}</Text>
      <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    margin: 20,
    borderRadius: 24,
    padding: 24,
    paddingBottom: 20,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadowHeavy,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  name: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 22,
    color: Colors.text,
    marginTop: 12,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  metaLine: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  employeeId: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
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
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  timeChipTextIn: {
    color: Colors.success,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginLeft: 4,
  },
  summaryCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  summaryBlock: {
    padding: 10,
    borderRadius: 12,
    gap: 2,
  },
  summaryLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  summaryBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  footerMuted: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
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
  taskItem: {
    marginBottom: 8,
    gap: 2,
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
  taskLine: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.text,
  },
  taskDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginLeft: 11, // aligned with the task title (dot width + gap)
    lineHeight: 16,
  },
  actionsCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  actionRowLast: {
    borderBottomWidth: 0,
  },
  actionRowPressed: {
    backgroundColor: Colors.surfacePressed,
  },
  actionLabel: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  cancelSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  cancelButton: {
    borderColor: Colors.border,
    borderRadius: 12,
  },
  cancelButtonContent: {
    minHeight: 46,
  },
});
