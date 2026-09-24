// ============================================================================
// VEBOSSO EMS — Member Actions Modal (Owner Team)
// Everything about one person, top to bottom: who they are, today, documents,
// attendance (calendar + the day's log), tasks, salary, location, admin.
// White cards on the grey canvas, one idea per card.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { AppTheme, RoleAccent, appSoftShadow } from '../constants/theme';
import { ROLE_LABELS, WORK_LOG_STATUS_CONFIG } from '../constants/roles';
import { Profile, WorkLogStatus } from '../types/database';
import { MemberActiveTask } from './MemberCard';
import { BackfillGrantBar } from './BackfillGrantBar';
import { MemberAttendancePanel } from './MemberAttendancePanel';
import { MemberLocationSection } from './MemberLocationSection';
import { UserAvatar } from './UserAvatar';

interface MemberActionsModalProps {
  visible: boolean;
  member: Profile | null;
  onDismiss: () => void;
  onOpenDocuments: () => void;
  /** Uploads waiting for the owner's approval. */
  pendingDocsCount?: number;
  onOpenTasks: () => void;
  onOpenSalary: () => void;
  onOpenExpenses: () => void;
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
  onOpenDocuments,
  pendingDocsCount = 0,
  onOpenTasks,
  onOpenSalary,
  onOpenExpenses,
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
  const workLabel = isDone && dayReport ? 'Day report' : isWorking ? 'Working on' : 'Plan';
  const openTaskTotal = pendingTaskCount + inProgressTaskCount;

  const formattedCheckIn = checkInTime ? format(new Date(checkInTime), 'h:mm a') : null;
  const formattedCheckOut = checkOutTime ? format(new Date(checkOutTime), 'h:mm a') : null;

  const taskHint =
    openTaskTotal > 0 || doneTaskCount > 0
      ? [openTaskTotal > 0 ? `${openTaskTotal} open` : null, doneTaskCount > 0 ? `${doneTaskCount} done today` : null]
          .filter(Boolean)
          .join(' · ')
      : 'Give a task or see past ones';

  return (
    <Portal>
      <Modal visible onDismiss={onDismiss} contentContainerStyle={styles.container}>
        {/* Identity — stays put while the rest scrolls */}
        <View style={styles.header}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <UserAvatar
              uri={member.avatar_url}
              size={48}
              label={member.full_name.substring(0, 2).toUpperCase()}
              style={{ backgroundColor: avatarColors.bg }}
              labelStyle={{ color: avatarColors.text, fontFamily: 'Inter_700Bold', fontSize: 17 }}
            />
            <View style={styles.headerText}>
              <Text style={styles.name} numberOfLines={1}>{member.full_name}</Text>
              <Text style={styles.metaLine} numberOfLines={1}>
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
            </View>
            <Pressable
              onPress={onDismiss}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={18} color={AppTheme.inkSoft} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 1. Today */}
          <View style={styles.card}>
            <View style={styles.todayTop}>
              <Text style={styles.cardTitle}>Today</Text>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>

            {formattedCheckIn || formattedCheckOut ? (
              <View style={styles.timesRow}>
                <TimeCell icon="log-in" label="In" value={formattedCheckIn} color={AppTheme.green} />
                <View style={styles.timesDivider} />
                <TimeCell icon="log-out" label="Out" value={formattedCheckOut} color={AppTheme.inkSoft} />
              </View>
            ) : null}

            {currentStatus === 'on_leave' ? (
              <Text style={styles.muted}>On approved leave today.</Text>
            ) : workSummary ? (
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryLabel}>{workLabel}</Text>
                <Text style={styles.summaryBody} numberOfLines={4}>{workSummary}</Text>
              </View>
            ) : !formattedCheckIn ? (
              <Text style={styles.muted}>Hasn’t started the day yet.</Text>
            ) : null}
          </View>

          {/* 2. Documents */}
          <View style={styles.group}>
            <NavRow
              label="Documents"
              hint={
                pendingDocsCount > 0
                  ? `${pendingDocsCount} waiting for your approval`
                  : 'ID, certificates and other papers'
              }
              hintColor={pendingDocsCount > 0 ? AppTheme.amber : undefined}
              badge={pendingDocsCount > 0 ? String(pendingDocsCount) : undefined}
              icon="file-text"
              iconColor={AppTheme.violet}
              iconBg={AppTheme.violetSoft}
              onPress={onOpenDocuments}
              isLast
            />
          </View>

          {/* 3. Attendance — calendar, the day's log, then per-day extras */}
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Attendance</Text>
          <MemberAttendancePanel
            memberId={member.id}
            accentColor={RoleAccent.owner.color}
            enableDetailSheet={false}
            showDayHeader={false}
            showWorkedCount
            dayAction={(date) => (
              <BackfillGrantBar memberId={member.id} memberName={member.full_name} date={date} />
            )}
            footer={(date) => (
              <>
                <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Work & pay</Text>
                <View style={styles.group}>
                  <NavRow
                    label="Tasks by Boss"
                    hint={taskHint}
                    icon="clipboard"
                    iconColor={AppTheme.blue}
                    iconBg={AppTheme.blueSoft}
                    onPress={onOpenTasks}
                  />
                  <NavRow
                    label="Salary"
                    hint="Requests, payments and receipts"
                    icon="credit-card"
                    iconColor={AppTheme.green}
                    iconBg={AppTheme.greenSoft}
                    onPress={onOpenSalary}
                  />
                  <NavRow
                    label="Travel expenses"
                    hint="Claims, payments and receipts"
                    icon="navigation"
                    iconColor={AppTheme.violet}
                    iconBg={AppTheme.violetSoft}
                    onPress={onOpenExpenses}
                    isLast
                  />
                </View>
                <View style={styles.locationWrap}>
                  <MemberLocationSection
                    memberId={member.id}
                    date={date}
                    accentColor={RoleAccent.owner.color}
                  />
                </View>
              </>
            )}
          />

          {/* 4. Admin */}
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Manage</Text>
          <View style={styles.group}>
            {member.role === 'member' && (
              <NavRow
                label="Assign Manager"
                icon="users"
                iconColor={AppTheme.violet}
                iconBg={AppTheme.violetSoft}
                onPress={onAssignManager}
              />
            )}
            <NavRow
              label="Manage Profile"
              icon="settings"
              iconColor={AppTheme.charcoal}
              iconBg={AppTheme.soft}
              onPress={onManageProfile}
              isLast
            />
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

function TimeCell({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string | null;
  color: string;
}) {
  return (
    <View style={styles.timeCell}>
      <Feather name={icon} size={13} color={value ? color : AppTheme.mute} />
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={[styles.timeValue, !value && { color: AppTheme.mute }]}>{value ?? '—'}</Text>
    </View>
  );
}

function NavRow({
  label,
  hint,
  icon,
  iconColor,
  iconBg,
  onPress,
  isLast,
  trailingIcon = 'chevron-right',
  expanded,
  hintColor,
  badge,
}: {
  label: string;
  hint?: string;
  hintColor?: string;
  badge?: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
  isLast?: boolean;
  trailingIcon?: keyof typeof Feather.glyphMap;
  expanded?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
    >
      <View style={[styles.navIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={16} color={iconColor} />
      </View>
      <View style={[styles.navText, !isLast && styles.navTextDivider]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.navLabel}>{label}</Text>
          {hint ? (
            <Text style={[styles.navHint, hintColor ? { color: hintColor } : null]} numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>
        {badge ? (
          <View style={styles.navBadge}>
            <Text style={styles.navBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <Feather name={trailingIcon} size={16} color={AppTheme.mute} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppTheme.bg,
    marginHorizontal: 0,
    marginBottom: 0,
    marginTop: 'auto',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    overflow: 'hidden',
    ...appSoftShadow,
  },

  // Header
  header: {
    backgroundColor: AppTheme.card,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.hairline,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppTheme.soft2,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    color: AppTheme.ink,
    letterSpacing: -0.4,
  },
  metaLine: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
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
  },
  department: {
    fontFamily: 'Inter_400Regular',
    color: AppTheme.mute,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: AppTheme.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Body
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: AppTheme.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionTitleSpaced: {
    marginTop: 22,
  },
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    ...appSoftShadow,
  },
  cardTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: AppTheme.ink,
    letterSpacing: -0.3,
  },
  muted: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: AppTheme.mute,
  },

  // Today card
  todayTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.soft,
    borderRadius: 14,
    paddingVertical: 10,
  },
  timesDivider: {
    width: 1,
    height: 20,
    backgroundColor: AppTheme.hairline,
  },
  timeCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  timeLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
    color: AppTheme.mute,
  },
  timeValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: AppTheme.ink,
  },
  summaryBlock: {
    gap: 4,
  },
  summaryLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: AppTheme.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.inkSoft,
    lineHeight: 20,
  },

  // Grouped rows
  group: {
    backgroundColor: AppTheme.card,
    borderRadius: 20,
    overflow: 'hidden',
    ...appSoftShadow,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    gap: 12,
    minHeight: 60,
  },
  navRowPressed: {
    backgroundColor: AppTheme.soft,
  },
  navIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 14,
    paddingVertical: 11,
  },
  navTextDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.hairline,
  },
  navLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: AppTheme.ink,
  },
  navHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: AppTheme.mute,
    marginTop: 2,
  },
  navBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: AppTheme.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: AppTheme.white,
  },
  locationWrap: {
    marginTop: 16,
  },
});
