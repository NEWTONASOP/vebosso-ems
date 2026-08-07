// ============================================================================
// VEBOSSO EMS — Manager Dashboard (Work Status + Approvals + Tasks)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { differenceInMinutes, format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { ApprovalCard } from '../../components/ApprovalCard';
import { AssignTaskModal } from '../../components/AssignTaskModal';
import { CheckInModal } from '../../components/CheckInModal';
import { CheckOutModal } from '../../components/CheckOutModal';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { ListSkeleton, StatusCardSkeleton } from '../../components/LoadingSkeleton';
import { MemberPickerModal } from '../../components/MemberPickerModal';
import { NotificationBell } from '../../components/NotificationBell';
import { QuickActionCard } from '../../components/QuickActionCard';
import { TaskCard } from '../../components/TaskCard';
import {
  AppTheme as T,
  AppSpace,
  AppRadius,
  appShadow,
  appSoftShadow,
  screenChrome,
} from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Profile } from '../../types/database';

export default function ManagerDashboard() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const {
    pendingApprovals, isLoadingApprovals, approvalsError, todayLog, todayTasks, isLoadingToday,
    fetchPendingApprovals, fetchSettings, fetchTodayLog, fetchTodayTasks,
    approveCheckIn, rejectCheckIn, checkIn, updateCheckInPlan, checkOut, updateTaskStatus,
    subscribeToRealtime, unsubscribeFromRealtime,
    teamMembers, fetchTeamMembers, addTask,
  } = useWorkStore();

  const [refreshing, setRefreshing] = React.useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [editPlanLoading, setEditPlanLoading] = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [elapsed, setElapsed] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);
  const [assignTaskModalVisible, setAssignTaskModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [isAssigningTask, setIsAssigningTask] = useState(false);
  const [assignTargetWorkLog, setAssignTargetWorkLog] = useState<any>(null);
  const [selectedMemberForApproval, setSelectedMemberForApproval] = useState<Profile | null>(null);

  const pulseOpacity = useSharedValue(1);

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    await Promise.all([
      fetchPendingApprovals(profile.id),
      fetchSettings(),
      fetchTodayLog(profile.id),
      fetchTodayTasks(profile.id),
      fetchTeamMembers(profile.id),
    ]);
  }, [profile, fetchPendingApprovals, fetchSettings, fetchTodayLog, fetchTodayTasks, fetchTeamMembers]);

  useEffect(() => {
    if (!profile?.id) {
      console.warn('Profile not loaded yet');
      return;
    }
    
    loadData();
    subscribeToRealtime(profile.id, 'manager', profile.id);
    
    return () => unsubscribeFromRealtime();
  }, [profile, loadData, subscribeToRealtime, unsubscribeFromRealtime]);

  // Pulse animation for pending approval status
  useEffect(() => {
    if (todayLog?.status === 'pending_approval') {
      pulseOpacity.value = withRepeat(withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true);
    }
  }, [todayLog?.status, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  // Elapsed time counter
  useEffect(() => {
    if (todayLog?.status === 'working' && todayLog.check_in_time) {
      const interval = setInterval(() => {
        const mins = differenceInMinutes(new Date(), new Date(todayLog.check_in_time!));
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        setElapsed(`${h}h ${m}m`);
      }, 60000);
      // Set initial
      const mins = differenceInMinutes(new Date(), new Date(todayLog.check_in_time));
      setElapsed(`${Math.floor(mins / 60)}h ${mins % 60}m`);
      return () => clearInterval(interval);
    }
  }, [todayLog]);

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

  const handleCheckIn = useCallback(async (plan: string, photoUris?: string[]) => {
    setCheckInLoading(true);
    const result = await checkIn(plan, photoUris);
    setCheckInLoading(false);
    if (result.success) {
      setShowCheckIn(false);
      setSnackMessage('Check-in submitted! Waiting for approval.');
    } else {
      setSnackMessage(result.error || 'Failed to check in. Please try again.');
    }
  }, [checkIn]);

  const handleDismissCheckIn = useCallback(() => setShowCheckIn(false), []);
  const handleDismissEditPlan = useCallback(() => setShowEditPlan(false), []);
  const handleDismissCheckOut = useCallback(() => setShowCheckOut(false), []);

  const handleUpdatePlan = useCallback(async (plan: string) => {
    setEditPlanLoading(true);
    const result = await updateCheckInPlan(plan);
    setEditPlanLoading(false);
    if (result.success) {
      setShowEditPlan(false);
      setSnackMessage("Today's plan updated");
    } else {
      setSnackMessage(result.error || 'Failed to update plan');
    }
  }, [updateCheckInPlan]);

  const handleCheckOut = useCallback(async (report: string, photoUris: string[]) => {
    setCheckOutLoading(true);
    const result = await checkOut(report, photoUris);
    setCheckOutLoading(false);
    if (result.success) {
      setShowCheckOut(false);
      setSnackMessage('Day ended! Great work today.');
    } else {
      setSnackMessage(result.error || 'Failed to check out. Please try again.');
    }
  }, [checkOut]);

  const handleStatusChange = async (taskId: string, status: 'pending' | 'in_progress' | 'done', completionNote?: string) => {
    const result = await updateTaskStatus(taskId, status, completionNote);
    if (!result.success) {
      setSnackMessage(result.error || 'Failed to update task status');
    }
  };

  const handleOpenMemberPicker = () => {
    setMemberPickerVisible(true);
  };

  const handleSelectMember = (member: Profile) => {
    setSelectedMember(member);
    setMemberPickerVisible(false);
    setAssignTaskModalVisible(true);
  };

  const handleAssignTask = async (title: string, description: string | null, dueDate: string | null) => {
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

  const handleAssignAndApprove = (workLog: any) => {
    // Build a Profile-compatible object from the joined profiles data
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

  const handleAssignTaskFromApproval = async (title: string, description: string | null, dueDate: string | null) => {
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

  const renderPlanSection = () => {
    const canEditPlan =
      todayLog?.status === 'working' || todayLog?.status === 'pending_approval';
    if (!canEditPlan || !todayLog) return null;

    return (
      <View style={styles.planSection}>
        <View style={styles.planHeader}>
          <Text style={styles.planLabel}>Today&apos;s plan</Text>
          <AnimatedPressable
            scaleTo={0.96}
            onPress={() => setShowEditPlan(true)}
            style={styles.planUpdateBtn}
            accessibilityRole="button"
            accessibilityLabel="Update today&apos;s plan"
          >
            <Text style={styles.planUpdateText}>Update</Text>
          </AnimatedPressable>
        </View>
        {todayLog.check_in_plan ? (
          <Text style={styles.planText}>{todayLog.check_in_plan}</Text>
        ) : (
          <Text style={styles.planPlaceholder}>Tap Update to describe what you are working on</Text>
        )}
      </View>
    );
  };

  const renderWorkStatus = () => {
    if (isLoadingToday) return <StatusCardSkeleton />;

    const formatLogTime = (timeStr: string | null | undefined) => {
      if (!timeStr) return '--';
      try {
        return format(new Date(timeStr), 'hh:mm a');
      } catch {
        return '--';
      }
    };

    // Not checked in — charcoal primary CTA
    if (!todayLog) {
      return (
        <View style={[styles.statusCard, styles.statusCardHero]}>
          <View style={[styles.statusIconCircle, { backgroundColor: T.amberSoft }]}>
            <Feather name="sun" size={28} color={T.amber} />
          </View>
          <Text style={styles.statusTitle}>Ready to start?</Text>
          <Text style={styles.statusSubtitle}>
            Check in with today&apos;s plan so your owner can approve and you can begin.
          </Text>
          <AnimatedPressable
            scaleTo={0.97}
            onPress={() => setShowCheckIn(true)}
            style={styles.primaryCta}
            accessibilityRole="button"
            accessibilityLabel="Start Day"
          >
            <Feather name="play" size={16} color={T.white} />
            <Text style={styles.primaryCtaText}>Start Day</Text>
          </AnimatedPressable>
        </View>
      );
    }

    // Pending approval
    if (todayLog.status === 'pending_approval') {
      return (
        <Animated.View style={[styles.statusCard, styles.statusCardHero, pulseStyle]}>
          <View style={[styles.statusIconCircle, { backgroundColor: T.amberSoft }]}>
            <Feather name="clock" size={28} color={T.amber} />
          </View>
          <Text style={styles.heroLabel}>Check-in request</Text>
          <Text style={styles.heroValue}>Awaiting approval</Text>
          <Text style={styles.statusSubtitle}>
            Your plan is with the owner. You can still end your day if needed.
          </Text>
          
          <View style={styles.cardDetailsGroup}>
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Check-in sent</Text>
              <Text style={rowStyles.value}>{formatLogTime(todayLog.check_in_time)}</Text>
            </View>
          </View>

          {renderPlanSection()}

          <AnimatedPressable
            scaleTo={0.97}
            onPress={() => setShowCheckOut(true)}
            style={styles.destructiveCta}
            accessibilityRole="button"
            accessibilityLabel="End Day"
          >
            <Feather name="power" size={16} color={T.white} />
            <Text style={styles.destructiveCtaText}>End Day</Text>
          </AnimatedPressable>
        </Animated.View>
      );
    }

    // Working
    if (todayLog.status === 'working') {
      return (
        <View style={[styles.statusCard, styles.statusCardHero]}>
          <View style={[styles.statusIconCircle, { backgroundColor: T.greenSoft }]}>
            <Feather name="briefcase" size={28} color={T.green} />
          </View>
          <Text style={styles.heroLabel}>Elapsed today</Text>
          <Text style={styles.heroValue}>{elapsed || '0h 0m'}</Text>
          
          <View style={styles.cardDetailsGroup}>
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Started at</Text>
              <Text style={rowStyles.value}>{formatLogTime(todayLog.check_in_time)}</Text>
            </View>
            <View style={rowStyles.separator} />
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Your tasks done</Text>
              <Text style={rowStyles.value}>
                {todayTasks.filter((t) => t.status === 'done').length}/{todayTasks.length}
              </Text>
            </View>
          </View>

          {renderPlanSection()}

          <AnimatedPressable
            scaleTo={0.97}
            onPress={() => setShowCheckOut(true)}
            style={styles.destructiveCta}
            accessibilityRole="button"
            accessibilityLabel="End Day"
          >
            <Feather name="power" size={16} color={T.white} />
            <Text style={styles.destructiveCtaText}>End Day</Text>
          </AnimatedPressable>
        </View>
      );
    }

    // Pending checkout approval
    if (todayLog.status === 'pending_checkout') {
      return (
        <View style={styles.statusCard}>
          <View style={[styles.statusIconCircle, { backgroundColor: T.amberSoft }]}>
            <Feather name="clock" size={28} color={T.amber} />
          </View>
          <Text style={styles.heroLabel}>Check-out request</Text>
          <Text style={styles.heroValue}>Awaiting approval</Text>
          <Text style={styles.statusSubtitle}>
            Your day report is being reviewed by the owner.
          </Text>
          
          <View style={styles.cardDetailsGroup}>
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Check-in</Text>
              <Text style={rowStyles.value}>{formatLogTime(todayLog.check_in_time)}</Text>
            </View>
            <View style={rowStyles.separator} />
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Check-out sent</Text>
              <Text style={rowStyles.value}>{formatLogTime(todayLog.check_out_time)}</Text>
            </View>
          </View>
        </View>
      );
    }

    // Done
    if (todayLog.status === 'done') {
      const formattedHours = todayLog.total_hours ? `${Math.floor(todayLog.total_hours)}h ${Math.round((todayLog.total_hours % 1) * 60)}m` : '--';
      return (
        <View style={styles.statusCard}>
          <View style={[styles.statusIconCircle, { backgroundColor: T.greenSoft }]}>
            <Feather name="check-circle" size={28} color={T.green} />
          </View>
          <Text style={styles.heroLabel}>Total hours logged</Text>
          <Text style={styles.heroValue}>{formattedHours}</Text>
          
          <View style={styles.cardDetailsGroup}>
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Check-in</Text>
              <Text style={rowStyles.value}>{formatLogTime(todayLog.check_in_time)}</Text>
            </View>
            <View style={rowStyles.separator} />
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Check-out</Text>
              <Text style={rowStyles.value}>{formatLogTime(todayLog.check_out_time)}</Text>
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  const today = format(new Date(), 'EEEE, d MMMM');
  const firstName = profile?.full_name?.split(' ')[0] || 'Manager';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const pendingCount = pendingApprovals.length;

  return (
    <>
    <ScrollView
      style={screenChrome.root}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.charcoal} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.greeting}>Good {greeting},</Text>
          <Text style={styles.name}>{firstName}</Text>
          <Text style={styles.date}>{today}</Text>
        </View>
        <NotificationBell role="manager" />
      </View>

      <View style={styles.workStatusContainer}>
        {renderWorkStatus()}
      </View>

      {todayTasks.length > 0 && (
        <View style={styles.tasksSection}>
          <Text style={styles.sectionLabel}>Today&apos;s tasks</Text>
          <View style={styles.tasksContainer}>
            {todayTasks.map((task, index) => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onStatusChange={handleStatusChange}
                isLast={index === todayTasks.length - 1}
                index={index}
              />
            ))}
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>Quick actions</Text>
      <View style={styles.quickActionsContainer}>
        <QuickActionCard
          icon="clipboard"
          title="Assign Task"
          subtitle="Create a new task"
          onPress={handleOpenMemberPicker}
        />
        <QuickActionCard
          icon="check-square"
          title="Track Tasks"
          subtitle="View tasks given to team"
          onPress={() => router.push('/(manager)/tasks')}
        />
      </View>

      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionLabel, styles.sectionLabelTight]}>
            Team check-ins
            {pendingCount > 0 ? ` · ${pendingCount}` : ''}
          </Text>
          <Text style={styles.sectionHint}>Approve so your team can start their day</Text>
        </View>
        {pendingApprovals.length > 5 && (
          <AnimatedPressable
            scaleTo={0.96}
            onPress={() => router.push('/(manager)/approvals')}
            style={styles.viewAllBtn}
            accessibilityRole="button"
            accessibilityLabel="View all approvals"
          >
            <Text style={styles.viewAllText}>See all</Text>
            <Feather name="chevron-right" size={16} color={T.mute} />
          </AnimatedPressable>
        )}
      </View>

      <View style={styles.listContainer}>
        {isLoadingApprovals ? (
          <ListSkeleton count={2} variant="approval" />
        ) : approvalsError ? (
          <InlineError
            message={approvalsError}
            onRetry={() => profile?.id && fetchPendingApprovals(profile.id)}
          />
        ) : pendingApprovals.length === 0 ? (
          <EmptyState
            icon="checkbox-marked-circle-outline"
            title="All caught up"
            subtitle="No pending check-ins from your team. Assign a task or check My Team for live status."
            actionLabel="Assign a task"
            onAction={handleOpenMemberPicker}
          />
        ) : (
          pendingApprovals.slice(0, 5).map((workLog) => (
            <ApprovalCard
              key={workLog.id}
              workLog={workLog}
              onApprove={handleApprove}
              onReject={handleReject}
              onAssignAndApprove={handleAssignAndApprove}
              isApproving={approvingId === workLog.id}
              isRejecting={rejectingId === workLog.id}
            />
          ))
        )}
      </View>

    </ScrollView>

    {showCheckIn ? (
      <CheckInModal
        visible
        onDismiss={handleDismissCheckIn}
        onSubmit={handleCheckIn}
        isLoading={checkInLoading}
      />
    ) : null}
    {showEditPlan ? (
      <CheckInModal
        visible
        mode="edit"
        initialPlan={todayLog?.check_in_plan ?? ''}
        onDismiss={handleDismissEditPlan}
        onSubmit={handleUpdatePlan}
        isLoading={editPlanLoading}
      />
    ) : null}
    {showCheckOut ? (
      <CheckOutModal
        visible
        onDismiss={handleDismissCheckOut}
        onSubmit={handleCheckOut}
        isLoading={checkOutLoading}
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
    </>
  );
}

const rowStyles = StyleSheet.create({
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 46,
  },
  label: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.inkSoft,
  },
  value: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.ink,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.hairline,
    marginHorizontal: 16,
  },
});

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpace.screen,
    paddingTop: screenChrome.headerRow.paddingTop,
    paddingBottom: 12,
  },
  greeting: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.mute,
  },
  name: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    color: T.ink,
    marginTop: 2,
    letterSpacing: -0.9,
  },
  date: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: T.mute,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingRight: AppSpace.screen,
  },
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: T.ink,
    letterSpacing: -0.35,
    paddingHorizontal: AppSpace.screen,
    marginTop: 28,
    marginBottom: 10,
  },
  sectionLabelTight: {
    marginBottom: 2,
  },
  sectionHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: T.mute,
    paddingHorizontal: AppSpace.screen,
    marginBottom: 10,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    gap: 2,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  viewAllText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.mute,
  },
  listContainer: {
    paddingHorizontal: AppSpace.screen,
  },
  workStatusContainer: {
    paddingHorizontal: AppSpace.screen,
    marginTop: 4,
  },
  statusCard: {
    backgroundColor: T.card,
    borderRadius: AppRadius.card,
    padding: 22,
    alignItems: 'center',
    ...appSoftShadow,
  },
  statusCardHero: {
    ...appShadow,
  },
  statusIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.mute,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  heroValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: T.ink,
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  cardDetailsGroup: {
    width: '100%',
    backgroundColor: T.soft,
    borderRadius: 16,
    marginTop: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  statusTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: T.ink,
    letterSpacing: -0.4,
  },
  statusSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: T.inkSoft,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  primaryCta: {
    ...screenChrome.primaryPill,
    width: '100%',
    height: 48,
    marginTop: 20,
  },
  primaryCtaText: {
    ...screenChrome.primaryPillText,
    fontSize: 15,
  },
  destructiveCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.coral,
    borderRadius: AppRadius.pill,
    height: 48,
    width: '100%',
    marginTop: 12,
    gap: 6,
  },
  destructiveCtaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.white,
    letterSpacing: -0.1,
  },
  tasksSection: {
    marginTop: 4,
  },
  tasksContainer: {
    paddingHorizontal: AppSpace.screen,
    paddingTop: 2,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: AppSpace.screen,
  },
  planSection: {
    width: '100%',
    marginTop: 8,
    marginBottom: 4,
    padding: 14,
    backgroundColor: T.soft,
    borderRadius: 14,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.inkSoft,
  },
  planUpdateBtn: {
    minHeight: 36,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  planUpdateText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.charcoal,
  },
  planText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.ink,
    lineHeight: 20,
    marginTop: 6,
  },
  planPlaceholder: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.mute,
    lineHeight: 20,
    marginTop: 6,
    fontStyle: 'italic',
  },
});
