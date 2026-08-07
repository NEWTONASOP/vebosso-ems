// ============================================================================
// VEBOSSO EMS — Owner Dashboard
// Soft iOS look, plain language, one job per section
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { ApprovalCard } from '../../components/ApprovalCard';
import { AssignTaskModal } from '../../components/AssignTaskModal';
import { InlineError } from '../../components/InlineError';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { MemberPickerModal } from '../../components/MemberPickerModal';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useWorkStore } from '../../store/workStore';
import { Profile } from '../../types/database';
import { AppTheme as T, appShadow as shadow } from '../../constants/theme';

const ENTER = Easing.bezier(0.22, 1, 0.36, 1);

export default function OwnerDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const {
    stats,
    pendingApprovals,
    isLoadingApprovals,
    approvalsError,
    teamMembers,
    fetchStats,
    fetchPendingApprovals,
    fetchSettings,
    fetchTeamMembers,
    approveCheckIn,
    rejectCheckIn,
    subscribeToRealtime,
    unsubscribeFromRealtime,
    addTask,
  } = useWorkStore();

  const [refreshing, setRefreshing] = React.useState(false);
  const [memberPickerVisible, setMemberPickerVisible] = React.useState(false);
  const [assignTaskModalVisible, setAssignTaskModalVisible] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<Profile | null>(null);
  const [isAssigningTask, setIsAssigningTask] = React.useState(false);
  const [approvingId, setApprovingId] = React.useState<string | null>(null);
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [snackMessage, setSnackMessage] = React.useState('');
  const [assignTargetWorkLog, setAssignTargetWorkLog] = React.useState<any>(null);
  const [selectedMemberForApproval, setSelectedMemberForApproval] = React.useState<Profile | null>(null);

  const loadData = useCallback(async () => {
    await Promise.all([
      fetchStats(),
      fetchPendingApprovals(),
      fetchSettings(),
      fetchTeamMembers(),
    ]);
  }, [fetchStats, fetchPendingApprovals, fetchSettings, fetchTeamMembers]);

  useEffect(() => {
    if (!profile?.id) {
      console.warn('Profile not loaded yet');
      return;
    }
    loadData();
    subscribeToRealtime(profile.id, 'owner');
    return () => unsubscribeFromRealtime();
  }, [profile?.id, loadData, subscribeToRealtime, unsubscribeFromRealtime]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleApprove = async (workLogId: string) => {
    if (!profile?.id) return;
    setApprovingId(workLogId);
    const result = await approveCheckIn(workLogId, profile.id);
    setApprovingId(null);
    if (!result.success) {
      setSnackMessage(result.error || 'Failed to approve check-in. Please try again.');
    }
  };

  const handleReject = async (workLogId: string) => {
    if (!profile?.id) return;
    setRejectingId(workLogId);
    const result = await rejectCheckIn(workLogId, profile.id, 'Please revise your plan');
    setRejectingId(null);
    if (!result.success) {
      setSnackMessage(result.error || 'Failed to reject check-in. Please try again.');
    }
  };

  const handleAssignAndApprove = (workLog: any) => {
    const targetMember = {
      id: workLog.user_id,
      full_name: workLog.profiles.full_name,
      employee_id: workLog.profiles.employee_id,
      role: workLog.profiles.role,
      department: workLog.profiles.department,
      avatar_url: workLog.profiles.avatar_url,
      is_active: true,
      manager_id: null,
      expo_push_token: null,
      must_change_password: false,
      created_at: '',
      updated_at: '',
      created_by: null,
    };
    setSelectedMemberForApproval(targetMember);
    setAssignTargetWorkLog(workLog);
    setAssignTaskModalVisible(true);
  };

  const handleAssignTaskFromApproval = async (
    title: string,
    description: string | null,
    dueDate: string | null
  ) => {
    if (!profile?.id || !assignTargetWorkLog) return;
    setIsAssigningTask(true);
    const result = await approveCheckIn(assignTargetWorkLog.id, profile.id, [
      {
        assigned_to: assignTargetWorkLog.user_id,
        assigned_by: profile.id,
        work_log_id: assignTargetWorkLog.id,
        title,
        description,
        due_date: dueDate,
        status: 'pending',
      },
    ]);
    setIsAssigningTask(false);
    if (result.success) {
      setSnackMessage('Approved & task assigned');
      setAssignTaskModalVisible(false);
      setSelectedMemberForApproval(null);
      setAssignTargetWorkLog(null);
    } else {
      setSnackMessage(result.error || 'Failed to approve. Please try again.');
    }
  };

  const handleSelectMember = (member: Profile) => {
    setSelectedMember(member);
    setMemberPickerVisible(false);
    setAssignTaskModalVisible(true);
  };

  const handleAssignTask = async (
    title: string,
    description: string | null,
    dueDate: string | null
  ) => {
    if (!profile?.id || !selectedMember?.id) return;
    setIsAssigningTask(true);
    const result = await addTask({
      assigned_to: selectedMember.id,
      assigned_by: profile.id,
      title,
      description,
      due_date: dueDate,
      status: 'pending',
    });
    setIsAssigningTask(false);
    if (result.success) {
      setSnackMessage(`Task assigned to ${selectedMember.full_name}`);
      setAssignTaskModalVisible(false);
      setSelectedMember(null);
    } else {
      setSnackMessage(result.error || 'Failed to assign task. Please try again.');
    }
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const today = format(new Date(), 'EEEE, d MMMM');
  const stillLoading = isLoadingApprovals && stats.totalMembers === 0;
  const pendingCount = stats.pendingApprovals;
  const hasPending = pendingCount > 0;

  return (
    <>
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(insets.top, 12) + 10 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={T.ink}
              colors={[T.ink]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Greeting */}
          <Animated.View entering={FadeIn.duration(420).easing(ENTER)} style={styles.header}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.hello}>Hello {firstName}</Text>
              <Text style={styles.date}>{today}</Text>
            </View>
            <SoftBell />
          </Animated.View>

          {/* 2. The one thing that needs the owner today */}
          <Animated.View entering={FadeInDown.delay(50).duration(500).easing(ENTER)}>
            <View style={styles.hero}>
              <View style={styles.heroGlow} />

              {stillLoading ? (
                <ActivityIndicator color="#fff" style={{ marginVertical: 26 }} />
              ) : hasPending ? (
                <>
                  <View style={styles.heroEyebrowRow}>
                    <View style={styles.heroDot} />
                    <Text style={styles.heroEyebrow}>Needs you now</Text>
                  </View>
                  <Text style={styles.heroTitle}>
                    {pendingCount} check-in{pendingCount === 1 ? '' : 's'} waiting
                  </Text>
                  <Text style={styles.heroHint}>
                    Your team can’t start until you approve their plan.
                  </Text>
                  <AnimatedPressable
                    scaleTo={0.97}
                    onPress={() => router.push('/(owner)/approvals')}
                    style={styles.heroCta}
                  >
                    <Text style={styles.heroCtaText}>Review now</Text>
                    <Feather name="arrow-right" size={17} color={T.ink} />
                  </AnimatedPressable>
                </>
              ) : (
                <>
                  <View style={styles.heroEyebrowRow}>
                    <Feather name="check-circle" size={14} color="rgba(255,255,255,0.55)" />
                    <Text style={styles.heroEyebrow}>All caught up</Text>
                  </View>
                  <Text style={styles.heroTitle}>Nothing needs approval</Text>
                  <Text style={styles.heroHint}>
                    {stats.activeNow > 0
                      ? `${stats.activeNow} ${stats.activeNow === 1 ? 'person is' : 'people are'} working right now.`
                      : 'No one has checked in yet today.'}
                  </Text>
                  <AnimatedPressable
                    scaleTo={0.97}
                    onPress={() => setMemberPickerVisible(true)}
                    style={styles.heroCtaGhost}
                  >
                    <Feather name="plus" size={16} color="#fff" />
                    <Text style={styles.heroCtaGhostText}>Assign a task</Text>
                  </AnimatedPressable>
                </>
              )}
            </View>
          </Animated.View>

          {/* 3. Today at a glance — one calm strip, not four boxes */}
          <Animated.View entering={FadeInDown.delay(120).duration(500).easing(ENTER)}>
            <View style={styles.glanceStrip}>
              <GlanceStat
                color={T.green}
                soft={T.greenSoft}
                icon="user-check"
                value={stillLoading ? '—' : String(stats.activeNow)}
                label="Working"
              />
              <View style={styles.glanceDivider} />
              <GlanceStat
                color={T.amber}
                soft={T.amberSoft}
                icon="sun"
                value={stillLoading ? '—' : String(stats.onLeaveToday)}
                label="On leave"
              />
              <View style={styles.glanceDivider} />
              <GlanceStat
                color={T.blue}
                soft={T.blueSoft}
                icon="users"
                value={stillLoading ? '—' : String(stats.totalMembers)}
                label="Team"
              />
            </View>
          </Animated.View>

          {/* 4. Two clear actions */}
          <Animated.View entering={FadeInDown.delay(180).duration(500).easing(ENTER)}>
            <Text style={styles.sectionLabel}>Quick actions</Text>
            <View style={styles.actionsCol}>
              <ActionCard
                icon="plus-circle"
                color={T.violet}
                soft={T.violetSoft}
                title="Assign a task"
                subtitle="Give work to a team member"
                onPress={() => setMemberPickerVisible(true)}
              />
              <ActionCard
                icon="check-square"
                color={T.blue}
                soft={T.blueSoft}
                title="See team tasks"
                subtitle="Track what you already assigned"
                onPress={() => router.push('/(owner)/tasks')}
              />
            </View>
          </Animated.View>

          {/* 5. Actual approvals list */}
          <Animated.View entering={FadeInUp.delay(240).duration(520).easing(ENTER)}>
            <View style={styles.sectionHead}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.sectionLabelTight}>Pending check-ins</Text>
                <Text style={styles.sectionHint}>
                  Approve so people can start their day
                </Text>
              </View>
              {pendingApprovals.length > 3 ? (
                <AnimatedPressable
                  scaleTo={0.96}
                  onPress={() => router.push('/(owner)/approvals')}
                  style={styles.viewAll}
                >
                  <Text style={styles.viewAllText}>See all</Text>
                  <Feather name="chevron-right" size={16} color={T.mute} />
                </AnimatedPressable>
              ) : null}
            </View>

            {isLoadingApprovals ? (
              <ListSkeleton count={2} variant="approval" />
            ) : approvalsError ? (
              <InlineError message={approvalsError} onRetry={() => fetchPendingApprovals()} />
            ) : pendingApprovals.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyCheck}>
                  <Feather name="inbox" size={20} color={T.mute} />
                </View>
                <Text style={styles.emptyTitle}>Nothing to approve</Text>
                <Text style={styles.emptySub}>
                  When someone checks in, their request shows up here.
                </Text>
              </View>
            ) : (
              pendingApprovals.slice(0, 3).map((workLog, index) => (
                <ApprovalCard
                  key={workLog.id}
                  workLog={workLog}
                  index={index}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onAssignAndApprove={handleAssignAndApprove}
                  isApproving={approvingId === workLog.id}
                  isRejecting={rejectingId === workLog.id}
                />
              ))
            )}
          </Animated.View>
        </ScrollView>
      </View>

      <MemberPickerModal
        visible={memberPickerVisible}
        onDismiss={() => {
          setMemberPickerVisible(false);
          setSelectedMember(null);
        }}
        members={teamMembers}
        selectedMember={selectedMember}
        onSelectMember={handleSelectMember}
      />

      {assignTaskModalVisible ? (
        <AssignTaskModal
          visible
          onDismiss={() => {
            setAssignTaskModalVisible(false);
            setSelectedMember(null);
            setSelectedMemberForApproval(null);
            setAssignTargetWorkLog(null);
          }}
          targetMember={selectedMember || selectedMemberForApproval}
          onSubmit={assignTargetWorkLog ? handleAssignTaskFromApproval : handleAssignTask}
          isLoading={isAssigningTask}
        />
      ) : null}

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={3000}
        wrapperStyle={{ marginBottom: 90 }}
      >
        {snackMessage}
      </Snackbar>
    </>
  );
}

// ---------------------------------------------------------------------------

function SoftBell() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { unreadCount, fetchNotifications, setupSubscription } = useNotificationStore();

  useEffect(() => {
    if (!profile?.id) return;
    fetchNotifications(profile.id);
    return setupSubscription(profile.id);
  }, [profile?.id, fetchNotifications, setupSubscription]);

  return (
    <AnimatedPressable
      scaleTo={0.9}
      onPress={() => router.push('/(owner)/notifications' as any)}
      style={styles.bell}
    >
      <Feather name="bell" size={18} color={T.ink} />
      {unreadCount > 0 ? (
        <View style={styles.bellDot}>
          <Text style={styles.bellDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

function GlanceStat({
  icon,
  color,
  soft,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  color: string;
  soft: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.glanceStat}>
      <View style={[styles.glanceIcon, { backgroundColor: soft }]}>
        <Feather name={icon} size={13} color={color} />
      </View>
      <Text style={styles.glanceValue}>{value}</Text>
      <Text style={styles.glanceLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({
  icon,
  color,
  soft,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  color: string;
  soft: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable scaleTo={0.98} onPress={onPress} style={styles.actionCard}>
      <View style={[styles.actionIcon, { backgroundColor: soft }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSub}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={T.mute} />
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 130,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  hello: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    color: T.ink,
    letterSpacing: -0.9,
  },
  date: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.mute,
    marginTop: 4,
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: T.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellDotText: {
    color: '#fff',
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    lineHeight: 10,
  },

  hero: {
    backgroundColor: T.charcoal,
    borderRadius: 28,
    padding: 22,
    overflow: 'hidden',
    marginBottom: 14,
    ...shadow,
  },
  heroGlow: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: T.onDarkAccent,
  },
  heroEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.68)',
    letterSpacing: 0.2,
  },
  heroTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 25,
    color: '#fff',
    letterSpacing: -0.6,
    lineHeight: 31,
    maxWidth: 290,
  },
  heroHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.66)',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 290,
  },
  heroCta: {
    marginTop: 20,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 999,
  },
  heroCtaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.ink,
  },
  heroCtaGhost: {
    marginTop: 20,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 999,
  },
  heroCtaGhostText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14.5,
    color: '#fff',
  },

  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: T.ink,
    letterSpacing: -0.35,
    marginTop: 28,
    marginBottom: 14,
  },
  sectionLabelTight: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: T.ink,
    letterSpacing: -0.35,
  },
  sectionHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: T.mute,
    marginTop: 4,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 28,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 2,
  },
  viewAllText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: T.mute,
  },

  glanceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderRadius: 20,
    paddingVertical: 18,
    ...shadow,
  },
  glanceStat: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
  },
  glanceDivider: {
    width: 1,
    height: 34,
    backgroundColor: T.hairline,
  },
  glanceIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glanceValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 21,
    color: T.ink,
    letterSpacing: -0.6,
    lineHeight: 25,
  },
  glanceLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
    color: T.mute,
  },

  actionsCol: {
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: T.card,
    ...shadow,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: T.ink,
    letterSpacing: -0.2,
  },
  actionSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: T.mute,
    marginTop: 4,
    lineHeight: 18,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: T.card,
    borderRadius: 20,
    ...shadow,
  },
  emptyCheck: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16.5,
    color: T.ink,
    letterSpacing: -0.2,
  },
  emptySub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.mute,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
});
