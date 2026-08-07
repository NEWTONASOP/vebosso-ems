import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { ApprovalCard } from '../../components/ApprovalCard';
import { AssignTaskModal } from '../../components/AssignTaskModal';
import { EmptyState } from '../../components/EmptyState';
import { LeaveCard } from '../../components/LeaveCard';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { AppSpace, AppTheme, screenChrome } from '../../constants/theme';
import { Alert } from '../../lib/alert';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { LeaveRequestWithProfile, WorkLogWithProfile } from '../../types/database';

export default function OwnerApprovalsScreen() {
  const { profile } = useAuthStore();
  const {
    pendingApprovals,
    isLoadingApprovals,
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
  const [assignTargetLog, setAssignTargetLog] = useState<WorkLogWithProfile | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [approvingLeaveId, setApprovingLeaveId] = useState<string | null>(null);
  const [rejectingLeaveId, setRejectingLeaveId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    await Promise.all([
      fetchPendingApprovals(),
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
    try {
      await approveCheckIn(workLogId, profile.id);
      setSnackMessage('Check-in approved');
    } catch {
      setSnackMessage('Failed to approve. Please try again.');
    }
  }, [profile, approveCheckIn]);

  const handleReject = useCallback((workLogId: string) => {
    if (!profile) return;
    Alert.alert(
      'Reject Request',
      'Are you sure you want to reject this request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectCheckIn(workLogId, profile.id, 'Please revise your plan and check in again.');
              setSnackMessage('Check-in rejected');
            } catch {
              setSnackMessage('Failed to reject. Please try again.');
            }
          }
        }
      ]
    );
  }, [profile, rejectCheckIn]);

  /** Leave approvals */
  const handleApproveLeave = useCallback(async (id: string) => {
    if (!profile) return;
    setApprovingLeaveId(id);
    const res = await approveLeaveRequest(id, profile.id);
    setApprovingLeaveId(null);
    if (res.success) {
      setSnackMessage('Leave request approved');
    } else {
      setSnackMessage(res.error || 'Failed to approve leave request.');
    }
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
            if (res.success) {
              setSnackMessage('Leave request rejected');
            } else {
              setSnackMessage(res.error || 'Failed to reject leave request.');
            }
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
    try {
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
      if (result.success) {
        setSnackMessage('Approved & task assigned');
      } else {
        setSnackMessage(result.error || 'Failed to approve.');
      }
    } catch {
      setSnackMessage('Failed to approve. Please try again.');
    } finally {
      setIsAssigning(false);
      setAssignTargetLog(null);
    }
  }, [profile, assignTargetLog, approveCheckIn]);

  const renderItem = useCallback(({ item }: { item: WorkLogWithProfile }) => (
    <ApprovalCard
      workLog={item}
      onApprove={handleApprove}
      onReject={handleReject}
      onAssignAndApprove={handleAssignAndApprove}
    />
  ), [handleApprove, handleReject, handleAssignAndApprove]);

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

  // Build a Profile-compatible object from the joined profiles data on the worklog
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

  const pendingLeaves = leaveRequests.filter((l) => l.status === 'pending');
  const isLoading = activeTab === 'attendance' ? isLoadingApprovals : isLoadingLeaves;
  const attendanceCount = pendingApprovals.length;
  const leavesCount = pendingLeaves.length;

  return (
    <View style={screenChrome.root}>
      <View style={screenChrome.header}>
        <Text style={screenChrome.title}>Approvals</Text>

        {/* Tab Selector */}
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
        <View style={styles.content}>
          <ListSkeleton count={3} variant="approval" />
        </View>
      ) : activeTab === 'attendance' ? (
        <FlatList
          data={pendingApprovals}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppTheme.charcoal} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="checkbox-marked-circle-outline"
              title="All caught up!"
              subtitle="No pending attendance approvals at the moment."
            />
          }
        />
      ) : (
        <FlatList
          data={pendingLeaves}
          renderItem={renderLeaveItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppTheme.charcoal} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-check"
              title="No Pending Leaves"
              subtitle="No pending leave requests at the moment."
            />
          }
        />
      )}

      {/* Assign Task Modal — shown when owner taps "Assign Task" on a check-in card */}
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
