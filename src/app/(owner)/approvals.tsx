// ============================================================================
// VEBOSSO EMS — Owner Approvals Screen
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, Platform } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { Alert } from '../../lib/alert';
import { ApprovalCard } from '../../components/ApprovalCard';
import { EmptyState } from '../../components/EmptyState';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { WorkLogWithProfile } from '../../types/database';

export default function OwnerApprovalsScreen() {
  const { profile } = useAuthStore();
  const {
    pendingApprovals,
    isLoadingApprovals,
    fetchPendingApprovals,
    approveCheckIn,
    rejectCheckIn,
  } = useWorkStore();

  const [refreshing, setRefreshing] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPendingApprovals();
    setRefreshing(false);
  };

  const handleApprove = useCallback(async (workLogId: string) => {
    if (!profile) return;
    try {
      await approveCheckIn(workLogId, profile.id);
      setSnackMessage('Check-in approved ✅');
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

  const renderItem = useCallback(({ item }: { item: WorkLogWithProfile }) => (
    <ApprovalCard workLog={item} onApprove={handleApprove} onReject={handleReject} />
  ), [handleApprove, handleReject]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Approvals</Text>
        <Text style={styles.subtitle}>
          {pendingApprovals.length} pending request{pendingApprovals.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {isLoadingApprovals ? (
        <View style={styles.content}>
          <ListSkeleton count={3} />
        </View>
      ) : (
        <FlatList
          data={pendingApprovals}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="checkbox-marked-circle-outline"
              title="All caught up!"
              subtitle="No pending approvals at the moment. Check back later."
            />
          }
        />
      )}

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={3000}
        style={{ bottom: 80 }}
      >
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 12 },
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, color: Colors.text, letterSpacing: -0.7 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  content: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 110 },
});
