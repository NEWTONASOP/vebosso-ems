// ============================================================================
// VEBOSSO EMS — Member Actions Modal (Owner Team)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Modal, Portal, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { ROLE_LABELS, WORK_LOG_STATUS_CONFIG } from '../constants/roles';
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
  const isWorking =
    currentStatus === 'working' ||
    currentStatus === 'pending_approval' ||
    currentStatus === 'pending_checkout';
  const isDone = currentStatus === 'done';
  const workSummary = isDone && dayReport ? dayReport : checkInPlan || null;
  const workLabel = isDone && dayReport ? 'Worked today' : isWorking ? 'Working on' : checkInPlan ? 'Plan' : null;
  const openTaskTotal = pendingTaskCount + inProgressTaskCount;

  const formattedCheckIn = checkInTime ? format(new Date(checkInTime), 'hh:mm a') : null;
  const formattedCheckOut = checkOutTime ? format(new Date(checkOutTime), 'hh:mm a') : null;

  const runAction = (action: () => void) => {
    action();
  };

  return (
    <Portal>
      <Modal visible onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.header}>
            <Avatar.Text
              size={64}
              label={member.full_name.substring(0, 2).toUpperCase()}
              style={{ backgroundColor: avatarColors.bg }}
              labelStyle={{ color: avatarColors.text, fontFamily: 'Inter_700Bold', fontSize: 22 }}
            />
            <Text style={styles.name}>{member.full_name}</Text>
            <Text style={styles.meta}>
              {member.employee_id}
              {member.department ? ` • ${member.department}` : ''}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.rolePill, { backgroundColor: Colors.accent }]}>
                <Text style={styles.rolePillText}>{ROLE_LABELS[member.role]}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
          </View>

          {(formattedCheckIn || formattedCheckOut || workSummary || openTaskTotal > 0 || doneTaskCount > 0) && (
            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>Today</Text>
              {(formattedCheckIn || formattedCheckOut) && (
                <View style={styles.summaryRow}>
                  {formattedCheckIn && (
                    <Text style={styles.summaryMeta}>Check-in {formattedCheckIn}</Text>
                  )}
                  {formattedCheckOut && (
                    <Text style={styles.summaryMeta}>Check-out {formattedCheckOut}</Text>
                  )}
                </View>
              )}
              {workSummary && workLabel && (
                <View style={styles.summaryBlock}>
                  <Text style={styles.summaryLabel}>{workLabel}</Text>
                  <Text style={styles.summaryBody}>{workSummary}</Text>
                </View>
              )}
              {(openTaskTotal > 0 || doneTaskCount > 0) && (
                <Text style={styles.summaryMeta}>
                  Tasks: {inProgressTaskCount} active • {pendingTaskCount} pending • {doneTaskCount} done
                </Text>
              )}
              {activeTasks.slice(0, 2).map((task, index) => (
                <Text key={`${task.title}-${index}`} style={styles.taskLine} numberOfLines={1}>
                  • {task.title}
                </Text>
              ))}
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

          <Pressable style={styles.cancelBtn} onPress={onDismiss}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </ScrollView>
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
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadowHeavy,
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
  meta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rolePillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Colors.white,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
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
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryBlock: {
    marginTop: 4,
  },
  summaryLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  summaryBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  summaryMeta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  taskLine: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionsCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
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
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
