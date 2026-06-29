// ============================================================================
// VEBOSSO EMS — Manager Approvals Screen
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Colors } from '../../constants/colors';
import { ApprovalCard } from '../../components/ApprovalCard';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { WorkLogWithProfile } from '../../types/database';

export default function ManagerApprovalsScreen() {
  const { profile } = useAuthStore();
  const { pendingApprovals, isLoadingApprovals, fetchPendingApprovals, approveCheckIn, rejectCheckIn } = useWorkStore();
  const [refreshing, setRefreshing] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  useEffect(() => {
    if (profile) fetchPendingApprovals(profile.id);
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (profile) await fetchPendingApprovals(profile.id);
    setRefreshing(false);
  };

  const handleApprove = async (workLogId: string) => {
    if (!profile) return;
    try { await approveCheckIn(workLogId, profile.id); setSnackMessage('Approved ✅'); } catch { setSnackMessage('Failed'); }
  };

  const handleReject = async (workLogId: string) => {
    if (!profile) return;
    try { await rejectCheckIn(workLogId, profile.id, 'Please revise'); setSnackMessage('Rejected'); } catch { setSnackMessage('Failed'); }
  };

  const renderItem = useCallback(({ item }: { item: WorkLogWithProfile }) => (
    <ApprovalCard workLog={item} onApprove={handleApprove} onReject={handleReject} />
  ), [profile]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Approvals</Text>
        <Text style={styles.subtitle}>{pendingApprovals.length} pending</Text>
      </View>
      {isLoadingApprovals ? (
        <View style={styles.content}><ListSkeleton count={3} /></View>
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
      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000} style={styles.snackbar}>{snackMessage}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  content: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  snackbar: { backgroundColor: Colors.surfaceLight },
});
