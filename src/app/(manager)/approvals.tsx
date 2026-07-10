import { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, View, Pressable } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { Alert } from '../../lib/alert';
import { ApprovalCard } from '../../components/ApprovalCard';
import { LeaveCard } from '../../components/LeaveCard';
import { AssignTaskModal } from '../../components/AssignTaskModal';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { Colors } from '../../constants/colors';
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Approvals</Text>
        
        {/* Tab Selector */}
        <View style={styles.segmentedContainer}>
          <Pressable
            style={[styles.segmentBtn, activeTab === 'attendance' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('attendance')}
          >
            <Text style={[styles.segmentText, activeTab === 'attendance' && styles.segmentTextActive]}>
              Attendance ({pendingApprovals.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, activeTab === 'leaves' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('leaves')}
          >
            <Text style={[styles.segmentText, activeTab === 'leaves' && styles.segmentTextActive]}>
              Leaves ({pendingLeaves.length})
            </Text>
          </Pressable>
        </View>
      </View>
      
      {isLoading && !refreshing ? (
        <View style={styles.content}><ListSkeleton count={3} variant="approval" /></View>
      ) : currentError ? (
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          ListEmptyComponent={<EmptyState icon="checkbox-marked-circle-outline" title="All caught up!" subtitle="No pending attendance approvals" />}
        />
      ) : (
        <FlatList
          data={pendingLeaves}
          renderItem={renderLeaveItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          ListEmptyComponent={<EmptyState icon="calendar-check" title="No Pending Leaves" subtitle="No pending leave requests" />}
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
        theme={{ colors: { inverseSurface: '#1C1C1E', inverseOnSurface: '#FFFFFF' } }}
        wrapperStyle={{ marginBottom: 90 }}
      >
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 12 },
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, color: Colors.text, letterSpacing: -0.7, marginBottom: 12 },
  content: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 110 },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.systemGray6,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: Colors.surface,
    ...Colors.shadow,
  },
  segmentText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.accent,
  },
});
