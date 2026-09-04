// ============================================================================
// VEBOSSO EMS — Member Actions Modal (Owner Team)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Modal, Portal, Text } from 'react-native-paper';
import { AppTheme, RoleAccent, appSoftShadow } from '../constants/theme';
import { ROLE_LABELS, WORK_LOG_STATUS_CONFIG } from '../constants/roles';
import { Profile, WorkLogStatus } from '../types/database';
import { MemberActiveTask } from './MemberCard';
import { MemberAttendancePanel } from './MemberAttendancePanel';

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
                  <Feather name="log-in" size={11} color={AppTheme.green} />
                  <Text style={[styles.timeChipText, styles.timeChipTextIn]}>{formattedCheckIn}</Text>
                </View>
              )}
              {formattedCheckOut && (
                <View style={[styles.timeChip, styles.timeChipOut]}>
                  <Feather name="log-out" size={11} color={AppTheme.mute} />
                  <Text style={styles.timeChipText}>{formattedCheckOut}</Text>
                </View>
              )}
            </View>
          </View>

          {/* 1. Today's Work & Attendance Card */}
          {(formattedCheckIn || formattedCheckOut || workSummary || currentStatus === 'on_leave') && (
            <View style={styles.summaryCard}>
              <Text style={styles.cardSectionTitle}>Work & Attendance</Text>

              {currentStatus === 'on_leave' && (
                <Text style={styles.footerMuted}>On approved leave today</Text>
              )}

              {workSummary && workLabel && (
                <View style={[styles.summaryBlock, { backgroundColor: workLabelBg }]}>
                  <Text style={[styles.summaryLabel, { color: workLabelColor }]}>{workLabel}</Text>
                  <Text style={styles.summaryBody}>{workSummary}</Text>
                </View>
              )}
            </View>
          )}

          {/* 2. Today's Tasks Card */}
          {(openTaskTotal > 0 || doneTaskCount > 0) && (
            <View style={styles.summaryCard}>
              <Text style={styles.cardSectionTitle}>Assigned Tasks</Text>

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

              {activeTasks.length > 0 && (
                <View style={styles.taskListContainer}>
                  {activeTasks.slice(0, 3).map((task, index) => {
                    const chip = TASK_CHIP[task.status] || { color: AppTheme.mute, bg: AppTheme.soft };
                    return (
                      <View
                        key={`${task.title}-${index}`}
                        style={[styles.taskItem, { backgroundColor: chip.bg }]}
                      >
                        <View style={styles.taskRow}>
                          <View style={[styles.taskDot, { backgroundColor: chip.color }]} />
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
            </View>
          )}

          {/* 3. Attendance history — same day rail as the Attendance screen */}
          <Text style={styles.sectionTitle}>Attendance history</Text>
          <View style={styles.attendanceBlock}>
            <MemberAttendancePanel
              memberId={member.id}
              accentColor={RoleAccent.owner.color}
              enableDetailSheet={false}
              showLocation
            />
          </View>

          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsCard}>
            <ActionRow
              label="Assign Task"
              icon="clipboard"
              iconColor={AppTheme.blue}
              iconBg={AppTheme.blueSoft}
              onPress={() => runAction(onAssignTask)}
            />
            {member.role === 'member' && (
              <ActionRow
                label="Assign Manager"
                icon="users"
                iconColor={AppTheme.violet}
                iconBg={AppTheme.violetSoft}
                onPress={() => runAction(onAssignManager)}
              />
            )}
            <ActionRow
              label="Manage Profile"
              icon="settings"
              iconColor={AppTheme.charcoal}
              iconBg={AppTheme.soft}
              onPress={() => runAction(onManageProfile)}
              isLast
            />
          </View>
        </ScrollView>

        <View style={styles.cancelSection}>
          <Button
            mode="contained"
            onPress={onDismiss}
            style={styles.cancelButton}
            contentStyle={styles.cancelButtonContent}
            buttonColor={AppTheme.soft}
            textColor={AppTheme.charcoal}
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
  iconColor,
  iconBg,
  onPress,
  isLast,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed, isLast && styles.actionRowLast]}
      onPress={onPress}
    >
      <View style={[styles.actionIconChip, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={16} color={iconColor} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Feather name="chevron-right" size={16} color={AppTheme.mute} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppTheme.card,
    marginHorizontal: 0,
    marginBottom: 0,
    marginTop: 'auto',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    maxHeight: '88%',
    ...appSoftShadow,
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
    color: AppTheme.ink,
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
    color: AppTheme.inkSoft,
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
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.mute,
  },
  timeChipTextIn: {
    color: AppTheme.green,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: AppTheme.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginLeft: 4,
  },
  cardSectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: AppTheme.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  attendanceBlock: {
    marginBottom: 16,
  },
  taskListContainer: {
    marginTop: 10,
    gap: 8,
  },
  summaryCard: {
    backgroundColor: AppTheme.soft,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  summaryBlock: {
    padding: 12,
    borderRadius: 14,
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
    color: AppTheme.ink,
    lineHeight: 18,
  },
  footerMuted: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: AppTheme.mute,
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
  taskItem: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 4,
    gap: 4,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  taskLine: {
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: AppTheme.ink,
  },
  taskDesc: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: AppTheme.inkSoft,
    marginLeft: 12,
    lineHeight: 18,
  },
  actionsCard: {
    backgroundColor: AppTheme.card,
    borderRadius: 20,
    overflow: 'hidden',
    gap: 2,
    padding: 4,
    ...appSoftShadow,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
    minHeight: 48,
    borderRadius: 16,
  },
  actionRowLast: {},
  actionRowPressed: {
    backgroundColor: AppTheme.soft,
  },
  actionIconChip: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: AppTheme.ink,
  },
  cancelSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppTheme.hairline,
  },
  cancelButton: {
    borderRadius: 16,
  },
  cancelButtonContent: {
    minHeight: 48,
  },
});
