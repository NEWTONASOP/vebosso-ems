import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, Pressable } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { Alert } from '../../lib/alert';
import { ApprovalCard } from '../../components/ApprovalCard';
import { LeaveCard } from '../../components/LeaveCard';
import { AssignTaskModal } from '../../components/AssignTaskModal';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { AppSpace, AppTheme, screenChrome } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { WorkLogWithProfile, LeaveRequestWithProfile } from '../../types/database';

export default function ManagerApprovalsScreen() {
  const { profile } = useAuthStore();
  const {
    pendingApprovals,
    isLoadingApprovals,
    approvalsError,
    fetchPendingApprovals,
    approveCheckIn,
    rejectCheckIn,
    // Leaves store bindings
    leaveRequests,
    isLoadingLeaves,
    fetchLeaveRequests,
    approveLeaveRequest,
    rejectLeaveRequest,
  } = useWorkStore();

  const [activeTab, setActiveTab] = useState<'attendance' | 'leaves'>('attendance');
  const [refreshing, setRefreshing] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvingLeaveId, setApprovingLeaveId] = useState<string | null>(null);
  const [rejectingLeaveId, setRejectingLeaveId] = useState<string | null>(null);
  const [assignTargetLog, setAssignTargetLog] = useState<WorkLogWithProfile | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile) return;
    await Promise.all([
      fetchPendingApprovals(profile.id),
      fetchLeaveRequests(profile.role, profile.id),
    ]);
  }, [profile, fetchPendingApprovals, fetchLeaveRequests]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleApprove = useCallback(async (workLogId: string) => {
    if (!profile) return;
    setApprovingId(workLogId);
    const result = await approveCheckIn(workLogId, profile.id);
    setApprovingId(null);
    if (result.success) { setSnackMessage('Approved ✅'); } 
    else { setSnackMessage(result.error || 'Failed to approve. Please try again.'); }
  }, [profile, approveCheckIn]);

  const handleReject = useCallback(async (workLogId: string) => {
    if (!profile) return;
    setRejectingId(workLogId);
    const result = await rejectCheckIn(workLogId, profile.id, 'Please revise');
    setRejectingId(null);
    if (result.success) { setSnackMessage('Rejected'); } 
    else { setSnackMessage(result.error || 'Failed to reject. Please try again.'); }
  }, [profile, rejectCheckIn]);

  /** Leave approvals */
  const handleApproveLeave = useCallback(async (id: string) => {
    if (!profile) return;
    setApprovingLeaveId(id);
    const res = await approveLeaveRequest(id, profile.id);
    setApprovingLeaveId(null);
    if (res.success) { setSnackMessage('Leave request approved ✅'); }
    else { setSnackMessage(res.error || 'Failed to approve.'); }
  }, [profile, approveLeaveRequest]);

  const handleRejectLeave = useCallback((id: string) => {
    if (!profile) return;
    Alert.alert(
      'Reject Leave Request',
      'Are you sure you want to reject this leave request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setRejectingLeaveId(id);
            const res = await rejectLeaveRequest(id, profile.id);
            setRejectingLeaveId(null);
            if (res.success) { setSnackMessage('Leave request rejected ❌'); }
            else { setSnackMessage(res.error || 'Failed to reject.'); }
          }
        }
      ]
    );
  }, [profile, rejectLeaveRequest]);

  /** Opens the assign-task modal for the selected work log */
  const handleAssignAndApprove = useCallback((workLog: WorkLogWithProfile) => {
    setAssignTargetLog(workLog);
  }, []);

  /** Called when the modal form is submitted */
  const handleAssignModalSubmit = useCallback(async (
    title: string,
    description: string | null,
    dueDate: string | null,
  ) => {
    if (!profile || !assignTargetLog) return;
    setIsAssigning(true);
    const result = await approveCheckIn(assignTargetLog.id, profile.id, [
      {
        assigned_to: assignTargetLog.user_id,
        assigned_by: profile.id,
        work_log_id: assignTargetLog.id,
        title,
        description,
        due_date: dueDate,
        status: 'pending',
      },
    ]);
    setIsAssigning(false);
    setAssignTargetLog(null);
    if (result.success) { setSnackMessage('Approved & task assigned ✅'); }
    else { setSnackMessage(result.error || 'Failed to approve.'); }
  }, [profile, assignTargetLog, approveCheckIn]);

  const renderItem = useCallback(({ item }: { item: WorkLogWithProfile }) => (
    <ApprovalCard 
      workLog={item} 
      onApprove={handleApprove} 
      onReject={handleReject}
      onAssignAndApprove={handleAssignAndApprove}
      isApproving={approvingId === item.id}
      isRejecting={rejectingId === item.id}
    />
  ), [handleApprove, handleReject, handleAssignAndApprove, approvingId, rejectingId]);

  const renderLeaveItem = useCallback(({ item, index }: { item: LeaveRequestWithProfile; index: number }) => (
    <LeaveCard
      leave={item}
      onApprove={handleApproveLeave}
      onReject={handleRejectLeave}
      isApproving={approvingLeaveId === item.id}
      isRejecting={rejectingLeaveId === item.id}
      index={index}
    />
  ), [handleApproveLeave, handleRejectLeave, approvingLeaveId, rejectingLeaveId]);

  // Build a Profile-compatible object from the joined profiles data
  const assignTargetMember = assignTargetLog
    ? {
        id: assignTargetLog.user_id,
        full_name: assignTargetLog.profiles.full_name,
        employee_id: assignTargetLog.profiles.employee_id,
        role: assignTargetLog.profiles.role,
        department: assignTargetLog.profiles.department,
        avatar_url: assignTargetLog.profiles.avatar_url,
        is_active: true,
        manager_id: null,
        expo_push_token: null,
        must_change_password: false,
        created_at: '',
        updated_at: '',
        created_by: null,
      }
    : null;

  // Filter team pending leaves (exclude self requests)
  const pendingLeaves = leaveRequests.filter((l) => l.status === 'pending' && l.user_id !== profile?.id);
  const isLoading = activeTab === 'attendance' ? isLoadingApprovals : isLoadingLeaves;
  const currentError = activeTab === 'attendance' ? approvalsError : null;
  const attendanceCount = pendingApprovals.length;
  const leavesCount = pendingLeaves.length;

  return (
    <View style={screenChrome.root}>
      <View style={screenChrome.header}>
        <Text style={screenChrome.title}>Approvals</Text>

        <View style={[screenChrome.segmentTrack, styles.segmentMargin]}>
          <Pressable
            style={[
              screenChrome.segmentBtn,
              activeTab === 'attendance' && screenChrome.segmentBtnActive,
            ]}
            onPress={() => setActiveTab('attendance')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'attendance' }}
            accessibilityLabel={`Attendance${attendanceCount > 0 ? `, ${attendanceCount} pending` : ''}`}
          >
            <Text style={[screenChrome.segmentText, activeTab === 'attendance' && screenChrome.segmentTextActive]}>
              Attendance
            </Text>
            {attendanceCount > 0 ? (
              <View style={[styles.countBadge, activeTab === 'attendance' && styles.countBadgeActive]}>
                <Text style={[styles.countBadgeText, activeTab === 'attendance' && styles.countBadgeTextActive]}>
                  {attendanceCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            style={[
              screenChrome.segmentBtn,
              activeTab === 'leaves' && screenChrome.segmentBtnActive,
            ]}
            onPress={() => setActiveTab('leaves')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'leaves' }}
            accessibilityLabel={`Leaves${leavesCount > 0 ? `, ${leavesCount} pending` : ''}`}
          >
            <Text style={[screenChrome.segmentText, activeTab === 'leaves' && screenChrome.segmentTextActive]}>
              Leaves
            </Text>
            {leavesCount > 0 ? (
              <View style={[styles.countBadge, activeTab === 'leaves' && styles.countBadgeActive]}>
                <Text style={[styles.countBadgeText, activeTab === 'leaves' && styles.countBadgeTextActive]}>
                  {leavesCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
      
      {isLoading && !refreshing ? (
        <View style={styles.content}><ListSkeleton count={3} variant="approval" /></View>
      ) : currentError ? (
        <View style={{ paddingHorizontal: AppSpace.screen, marginTop: 8 }}>
          <InlineError
            message={currentError}
            onRetry={loadData}
          />
        </View>
      ) : activeTab === 'attendance' ? (
        <FlatList
          data={pendingApprovals}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppTheme.charcoal} />}
          ListEmptyComponent={
            <EmptyState
              icon="checkbox-marked-circle-outline"
              title="All caught up!"
              subtitle="No pending attendance approvals from your team. Pull to refresh anytime."
            />
          }
        />
      ) : (
        <FlatList
          data={pendingLeaves}
          renderItem={renderLeaveItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppTheme.charcoal} />}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-check"
              title="No pending leaves"
              subtitle="When a team member requests leave, it will show up here for review."
            />
          }
        />
      )}

      {/* Assign Task Modal — shown when manager taps "Assign Task" on a check-in card */}
      {assignTargetLog && assignTargetMember ? (
        <AssignTaskModal
          visible
          key={assignTargetLog.id}
          onDismiss={() => setAssignTargetLog(null)}
          onSubmit={handleAssignModalSubmit}
          targetMember={assignTargetMember}
          isLoading={isAssigning}
        />
      ) : null}

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={3000}
        theme={{ colors: { inverseSurface: AppTheme.charcoal, inverseOnSurface: AppTheme.white } }}
        wrapperStyle={{ marginBottom: 90 }}
      >
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  segmentMargin: { marginTop: 12 },
  countBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: AppTheme.soft2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeActive: {
    backgroundColor: AppTheme.charcoal,
  },
  countBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: AppTheme.inkSoft,
    letterSpacing: -0.2,
  },
  countBadgeTextActive: {
    color: AppTheme.white,
  },
  content: { paddingHorizontal: AppSpace.screen },
  list: {
    ...screenChrome.listPad,
    flexGrow: 1,
  },
});
