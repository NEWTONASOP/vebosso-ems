// ============================================================================
// VEBOSSO EMS — Manager Dashboard (Work Status + Approvals + Tasks)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { differenceInMinutes, format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Snackbar, Text } from 'react-native-paper';
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
import { QuickActionCard } from '../../components/QuickActionCard';
import { TaskCard } from '../../components/TaskCard';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Profile } from '../../types/database';
import { NotificationBell } from '../../components/NotificationBell';


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

  const handleCheckIn = useCallback(async (plan: string) => {
    setCheckInLoading(true);
    const result = await checkIn(plan);
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
          <Text style={styles.planLabel}>Today&apos;s Plan</Text>
          <Button compact mode="text" textColor={Colors.accent} onPress={() => setShowEditPlan(true)}>
            Update
          </Button>
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

    if (!todayLog) {
      return (
        <View style={styles.statusCard}>
          <Text style={styles.statusEmoji}>☀️</Text>
          <Text style={styles.statusTitle}>Ready to start?</Text>
          <Text style={styles.statusSubtitle}>Check in to begin your work day</Text>
          <Button 
            mode="contained" 
            onPress={() => setShowCheckIn(true)} 
            style={styles.startButton} 
            contentStyle={styles.startButtonContent} 
            buttonColor={Colors.accent} 
            textColor={Colors.white} 
            icon="play"
          >
            Start Day
          </Button>
        </View>
      );
    }

    if (todayLog.status === 'pending_approval') {
      return (
        <Animated.View style={[styles.statusCard, styles.pendingCard, pulseStyle]}>
          <Text style={styles.statusEmoji}>⏳</Text>
          <Text style={styles.statusTitle}>Waiting for Approval</Text>
          <Text style={styles.statusSubtitle}>Your check-in is being reviewed</Text>
          <View style={styles.pendingDots}>
            {[0, 1, 2].map((i) => <View key={i} style={[styles.dot, { backgroundColor: Colors.warning }]} />)}
          </View>
          {renderPlanSection()}
          <Button
            mode="contained"
            onPress={() => setShowCheckOut(true)}
            style={styles.endButton}
            buttonColor={Colors.error}
            textColor={Colors.white}
            icon="stop"
          >
            End Day
          </Button>
          <Text style={styles.endDayHint}>
            You may end your day even if your check-in has not been approved.
          </Text>
        </Animated.View>
      );
    }

    if (todayLog.status === 'working') {
      return (
        <View style={[styles.statusCard, styles.workingCard]}>
          <Text style={styles.statusEmoji}>💼</Text>
          <Text style={styles.statusTitle}>You&apos;re Working</Text>
          <View style={styles.workingInfo}>
            <View style={styles.workingDetail}>
              <Text style={styles.workingLabel}>Since</Text>
              <Text style={styles.workingValue}>{todayLog.check_in_time ? format(new Date(todayLog.check_in_time), 'hh:mm a') : '--'}</Text>
            </View>
            <View style={styles.workingDetail}>
              <Text style={styles.workingLabel}>Elapsed</Text>
              <Text style={styles.workingValue}>{elapsed}</Text>
            </View>
          </View>
          {renderPlanSection()}
          <Button
            mode="contained" 
            onPress={() => setShowCheckOut(true)} 
            style={styles.endButton} 
            buttonColor={Colors.error} 
            textColor={Colors.white} 
            icon="stop"
          >
            End Day
          </Button>
        </View>
      );
    }

    if (todayLog.status === 'done') {
      return (
        <View style={[styles.statusCard, styles.doneCard]}>
          <Text style={styles.statusEmoji}>✅</Text>
          <Text style={styles.statusTitle}>Day Complete</Text>
          <Text style={styles.statusSubtitle}>
            {todayLog.total_hours ? `${todayLog.total_hours} hours worked` : 'Great work today!'}
          </Text>
        </View>
      );
    }

    return null;
  };

  const today = format(new Date(), 'EEEE, MMMM dd');

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Greeting */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},
          </Text>
          <Text style={styles.name}>{profile?.full_name?.split(' ')[0] || 'Manager'} 👋</Text>
          <Text style={styles.date}>{today}</Text>
        </View>
        <NotificationBell role="manager" />
      </View>

      {/* My Work Status */}
      <View style={styles.workStatusContainer}>
        {renderWorkStatus()}
      </View>

      {/* Today's Tasks */}
      {todayTasks.length > 0 && (
        <View style={styles.tasksSection}>
          <Text style={styles.sectionTitle}>Today&apos;s Tasks</Text>
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

      {/* Pending Approvals Count Card */}
      <View style={styles.approvalCountCard}>
        <View style={[styles.iconBg, { backgroundColor: Colors.managerAccent + '12' }]}>
          <Feather name="clock" size={24} color={Colors.managerAccent} />
        </View>
        <View style={styles.approvalCountInfo}>
          <Text style={styles.approvalCountValue}>{pendingApprovals.length}</Text>
          <Text style={styles.approvalCountLabel}>Pending Approvals</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
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

      {/* Pending Approvals */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Team Check-in Requests
        </Text>
        {pendingApprovals.length > 5 && (
          <Text style={styles.viewAllBtn} onPress={() => router.push('/(manager)/approvals')}>
            View All
          </Text>
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
          <View style={styles.emptyCard}>
            <EmptyState
              icon="checkbox-marked-circle-outline"
              title="All caught up!"
              subtitle="No pending approvals from your team"
            />
          </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 12,
  },
  greeting: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  name: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: Colors.textPrimary,
    marginTop: 2,
    letterSpacing: -0.7,
  },
  date: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  approvalCountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  iconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  approvalCountInfo: {
    flex: 1,
  },
  approvalCountValue: {
    fontSize: 32,
    fontFamily: 'Inter_800ExtraBold',
    color: Colors.textPrimary,
    letterSpacing: -0.7,
  },
  approvalCountLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginTop: 26,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  viewAllBtn: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.accent,
    marginTop: 26,
    marginBottom: 12,
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  workStatusContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  pendingCard: { 
    borderColor: Colors.warning,
  },
  workingCard: { 
    borderColor: Colors.success,
  },
  doneCard: { 
    borderColor: Colors.border,
  },
  statusEmoji: { 
    fontSize: 44, 
    marginBottom: 10,
  },
  statusTitle: { 
    fontSize: 20, 
    fontFamily: 'Inter_700Bold', 
    color: Colors.textPrimary,
  },
  statusSubtitle: { 
    fontSize: 14, 
    fontFamily: 'Inter_500Medium', 
    color: Colors.textSecondary, 
    marginTop: 4, 
    textAlign: 'center',
  },
  startButton: { 
    borderRadius: 14, 
    marginTop: 20, 
    width: '100%',
  },
  startButtonContent: { 
    height: 52,
  },
  pendingDots: { 
    flexDirection: 'row', 
    gap: 6, 
    marginTop: 16,
  },
  dot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4,
  },
  workingInfo: { 
    flexDirection: 'row', 
    gap: 20, 
    marginTop: 16, 
    marginBottom: 16,
  },
  workingDetail: { 
    alignItems: 'center',
  },
  workingLabel: { 
    fontSize: 12, 
    fontFamily: 'Inter_500Medium', 
    color: Colors.textSecondary,
  },
  workingValue: { 
    fontSize: 18, 
    fontFamily: 'Inter_700Bold', 
    color: Colors.textPrimary, 
    marginTop: 2,
  },
  endButton: { 
    borderRadius: 14, 
    width: '100%',
    marginTop: 16,
  },
  endDayHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  tasksSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  tasksContainer: {
    paddingTop: 2,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  planSection: {
    width: '100%',
    marginTop: 8,
    marginBottom: 8,
    padding: 14,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  planText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginTop: 6,
  },
  planPlaceholder: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 6,
    fontStyle: 'italic',
  },
});
