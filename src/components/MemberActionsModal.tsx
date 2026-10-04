// ============================================================================
// VEBOSSO EMS — Member Actions Modal (Owner Team)
// Everything about one person, top to bottom: who they are, attendance
// (calendar + the day's log), work & pay, location, admin. Every Work & pay
// row (tasks, messages, salary, travel expenses, documents) opens as a dialog
// over this sheet (onOpenDialog), which stays open underneath.
// White cards on the grey canvas, one idea per card.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Modal, Portal, Switch, Text } from 'react-native-paper';
import { AppTheme, RoleAccent, appSoftShadow } from '../constants/theme';
import { ROLE_LABELS } from '../constants/roles';
import { Feature, FEATURES } from '../lib/featureAccess';
import { NavgrahLogo } from './NavgrahLogo';
import { useSheetLift } from '../lib/useKeyboardHeight';
import { useSheetEntrance } from '../lib/useSheetEntrance';
import { Profile } from '../types/database';
import { BackfillGrantBar } from './BackfillGrantBar';
import { Chevron } from './Dropdown';
import { MemberAttendancePanel } from './MemberAttendancePanel';
import { MemberLocationSection } from './MemberLocationSection';
import { UserAvatar } from './UserAvatar';

export type MemberDialog = 'tasks' | 'chat' | 'salary' | 'expenses' | 'documents';

interface MemberActionsModalProps {
  visible: boolean;
  member: Profile | null;
  onDismiss: () => void;
  /** The open dropdown, if any. */
  /** Tasks, messages, salary, travel expenses, documents — as a dialog over this sheet. */
  onOpenDialog: (dialog: MemberDialog) => void;
  /** Uploads waiting for the owner's approval. */
  pendingDocsCount?: number;
  /** Messages from this person the owner hasn't read. */
  unreadChatCount?: number;
  onAssignManager: () => void;
  onManageProfile: () => void;
  /** Which of Bills / Venues / Accounts they can use; null while loading. */
  access?: Record<Feature, boolean> | null;
  onToggleAccess?: (feature: Feature, grant: boolean) => void;
  pendingTaskCount?: number;
  inProgressTaskCount?: number;
  doneTaskCount?: number;
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
  onOpenDialog,
  pendingDocsCount = 0,
  unreadChatCount = 0,
  onAssignManager,
  onManageProfile,
  access = null,
  onToggleAccess,
  pendingTaskCount = 0,
  inProgressTaskCount = 0,
  doneTaskCount = 0,
}: MemberActionsModalProps) {
  const lifted = useSheetLift();
  const entrance = useSheetEntrance('sheet');

  if (!visible || !member) return null;

  const avatarColors = getAvatarColors(member.role);
  const roleMuted = getRoleMutedColor(member.role);
  const openTaskTotal = pendingTaskCount + inProgressTaskCount;
  const firstName = member.full_name.split(' ')[0];

  const taskHint =
    openTaskTotal > 0 || doneTaskCount > 0
      ? [openTaskTotal > 0 ? `${openTaskTotal} open` : null, doneTaskCount > 0 ? `${doneTaskCount} done today` : null]
          .filter(Boolean)
          .join(' · ')
      : 'Give a task or see past ones';

  return (
    <Portal>
      <Modal visible onDismiss={onDismiss} contentContainerStyle={[styles.container, lifted, entrance]}>
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
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Attendance — calendar, the day's log, then per-day extras */}
          <Text style={styles.sectionTitle}>Attendance</Text>
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
                    onPress={() => onOpenDialog('tasks')}
                  />
                  <NavRow
                    label="Messages"
                    hint={unreadChatCount > 0 ? `${unreadChatCount} new from ${firstName}` : `Chat with ${firstName}`}
                    hintColor={unreadChatCount > 0 ? AppTheme.violet : undefined}
                    badge={unreadChatCount > 0 ? String(unreadChatCount) : undefined}
                    icon="message-circle"
                    iconColor={AppTheme.violet}
                    iconBg={AppTheme.violetSoft}
                    onPress={() => onOpenDialog('chat')}
                  />
                  <NavRow
                    label="Salary"
                    hint="Monthly salary, payments and receipts"
                    icon="credit-card"
                    iconColor={AppTheme.green}
                    iconBg={AppTheme.greenSoft}
                    onPress={() => onOpenDialog('salary')}
                  />
                  <NavRow
                    label="Travel expenses"
                    hint="Claims, payments and receipts"
                    icon="navigation"
                    iconColor={AppTheme.violet}
                    iconBg={AppTheme.violetSoft}
                    onPress={() => onOpenDialog('expenses')}
                  />
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
                    onPress={() => onOpenDialog('documents')}
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

          {/* 2. Admin */}
          <View>
            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Manage</Text>
            <View style={styles.group}>
              {onToggleAccess
                ? FEATURES.map((f) => {
                    const on = !!access?.[f.key];
                    return (
                      <Pressable
                        key={f.key}
                        style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}
                        onPress={() => access && onToggleAccess(f.key, !on)}
                        disabled={!access}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`${f.label} access`}
                      >
                        <View style={[styles.navIcon, { backgroundColor: AppTheme.violetSoft }]}>
                          {f.key === 'leads' ? (
                            <NavgrahLogo size={18} color={AppTheme.violet} />
                          ) : (
                            <Feather name={f.icon} size={16} color={AppTheme.violet} />
                          )}
                        </View>
                        <View style={[styles.navText, styles.navTextDivider]}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.navLabel}>{f.label} access</Text>
                            <Text style={styles.navHint} numberOfLines={1}>
                              {on ? `Can ${f.hint.toLowerCase()}` : 'Off'}
                            </Text>
                          </View>
                          <Switch
                            value={on}
                            disabled={!access}
                            onValueChange={(v) => onToggleAccess(f.key, v)}
                            color={AppTheme.violet}
                          />
                        </View>
                      </Pressable>
                    );
                  })
                : null}
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
          </View>
        </ScrollView>
      </Modal>
    </Portal>
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
        {expanded === undefined ? (
          <Feather name={trailingIcon} size={16} color={AppTheme.mute} />
        ) : (
          <Chevron open={expanded} size={16} color={AppTheme.mute} />
        )}
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
