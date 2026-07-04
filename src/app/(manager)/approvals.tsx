// ============================================================================
// VEBOSSO EMS — Manager Approvals Screen
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { ApprovalCard } from '../../components/ApprovalCard';
import { AssignTaskModal } from '../../components/AssignTaskModal';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { WorkLogWithProfile } from '../../types/database';

export default function ManagerApprovalsScreen() {
  const { profile } = useAuthStore();
  const { pendingApprovals, isLoadingApprovals, approvalsError, fetchPendingApprovals, approveCheckIn, rejectCheckIn } = useWorkStore();
  const [refreshing, setRefreshing] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [assignTargetLog, setAssignTargetLog] = useState<WorkLogWithProfile | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (profile) fetchPendingApprovals(profile.id);
  }, [profile, fetchPendingApprovals]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (profile) await fetchPendingApprovals(profile.id);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Approvals</Text>
        <Text style={styles.subtitle}>{pendingApprovals.length} pending</Text>
      </View>
      {isLoadingApprovals ? (
        <View style={styles.content}><ListSkeleton count={3} /></View>
      ) : approvalsError ? (
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <InlineError
            message={approvalsError}
            onRetry={() => profile && fetchPendingApprovals(profile.id)}
          />
        </View>
      ) : (
        <FlatList
          data={pendingApprovals}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          ListEmptyComponent={<EmptyState icon="checkbox-marked-circle-outline" title="All caught up!" subtitle="No pending approvals" />}
        />
      )}

      {/* Assign Task Modal — shown when manager taps "Assign Task" on a check-in card */}
      <AssignTaskModal
        visible={!!assignTargetLog}
        onDismiss={() => setAssignTargetLog(null)}
        onSubmit={handleAssignModalSubmit}
        targetMember={assignTargetMember}
        isLoading={isAssigning}
      />

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000} wrapperStyle={{ marginBottom: 90 }}>{snackMessage}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 12 },
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, color: Colors.text, letterSpacing: -0.7 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  content: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 110 },
});
