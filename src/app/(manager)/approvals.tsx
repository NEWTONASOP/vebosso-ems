// ============================================================================
// VEBOSSO EMS — Manager Approvals Screen
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { ApprovalCard } from '../../components/ApprovalCard';
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

  const renderItem = useCallback(({ item }: { item: WorkLogWithProfile }) => (
    <ApprovalCard 
      workLog={item} 
      onApprove={handleApprove} 
      onReject={handleReject}
      isApproving={approvingId === item.id}
      isRejecting={rejectingId === item.id}
    />
  ), [handleApprove, handleReject, approvingId, rejectingId]);

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
      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000}>{snackMessage}</Snackbar>
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
